import Link from "next/link";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  or,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  Plus,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type SortDirection,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import {
  PRODUCT_STATUS_META,
  PRODUCT_STATUSES,
  seesAllData,
  type ProductStatus,
} from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { requireAgencyUser } from "@/lib/permissions";
import { client, product } from "@/lib/schema";
import { cn } from "@/lib/utils";

export const metadata = { title: "Proposals" };

const ROW_CAP = 200;

type SearchParams = Promise<{
  q?: string;
  status?: string;
  sort?: string;
  dir?: string;
}>;

// Sortable columns → the column they order by. Client sorts on the joined
// client name; total sorts on the numeric total price.
const SORTABLE = {
  reference: product.reference,
  title: product.title,
  client: client.name,
  status: product.status,
  total: product.totalPrice,
  updated: product.updatedAt,
} as const;
type SortKey = keyof typeof SORTABLE;

/**
 * A sortable column header that navigates (server-side re-order) via a Link,
 * preserving the active filters. Uses the deck's sortable TableHead affordance.
 */
function SortHead({
  href,
  dir,
  numeric = false,
  children,
}: {
  href: string;
  dir: SortDirection;
  numeric?: boolean;
  children: React.ReactNode;
}) {
  const Icon =
    dir === "asc" ? ChevronUp : dir === "desc" ? ChevronDown : ArrowUpDown;
  return (
    <TableHead
      numeric={numeric}
      aria-sort={
        dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"
      }
      className="group p-0"
    >
      <Link
        href={href}
        scroll={false}
        className={cn(
          "hover:text-foreground flex h-10 w-full items-center gap-1.5 px-4 transition-colors",
          numeric && "flex-row-reverse"
        )}
      >
        {children}
        <Icon
          className={cn(
            "size-3.5 shrink-0 transition-opacity",
            dir ? "opacity-100" : "opacity-50 group-hover:opacity-100"
          )}
          aria-hidden
        />
      </Link>
    </TableHead>
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireAgencyUser();
  const t = await getTranslations("proposalsList");
  const sp = await searchParams;

  const conditions: SQL[] = [eq(product.agencyId, user.agencyId)];
  // Agents see only proposals they created (others see all).
  if (!seesAllData(user.role))
    conditions.push(eq(product.createdById, user.id));
  if (sp.q) {
    const term = `%${sp.q}%`;
    const q = or(
      ilike(product.title, term),
      ilike(product.reference, term),
      ilike(client.name, term)
    );
    if (q) conditions.push(q);
  }
  if (sp.status && PRODUCT_STATUSES.includes(sp.status as ProductStatus))
    conditions.push(eq(product.status, sp.status));
  const where = and(...conditions);

  // Sort: default to most-recently-updated; honour ?sort=&dir= for the header.
  const sortKey = (
    sp.sort && sp.sort in SORTABLE ? sp.sort : "updated"
  ) as SortKey;
  const sortDir: "asc" | "desc" =
    sp.dir === "asc" || sp.dir === "desc"
      ? sp.dir
      : sortKey === "updated" || sortKey === "total"
        ? "desc"
        : "asc";
  const sortCol: SQLWrapper = SORTABLE[sortKey];
  const orderBy = sortDir === "asc" ? asc(sortCol) : desc(sortCol);

  const rows = await db
    .select({
      id: product.id,
      reference: product.reference,
      title: product.title,
      status: product.status,
      destination: product.destination,
      totalPrice: product.totalPrice,
      currency: product.currency,
      updatedAt: product.updatedAt,
      clientName: client.name,
    })
    .from(product)
    .leftJoin(client, eq(product.clientId, client.id))
    .where(where)
    .orderBy(orderBy, desc(product.updatedAt))
    .limit(ROW_CAP);

  // Build a sort-toggle href that preserves the active filters.
  const sortHref = (key: SortKey): string => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.status) params.set("status", sp.status);
    params.set("sort", key);
    // Toggle direction when clicking the active column, else sensible default.
    const nextDir =
      sortKey === key
        ? sortDir === "asc"
          ? "desc"
          : "asc"
        : key === "updated" || key === "total"
          ? "desc"
          : "asc";
    params.set("dir", nextDir);
    return `/proposals?${params.toString()}`;
  };
  const dirFor = (key: SortKey): SortDirection =>
    sortKey === key ? sortDir : false;

  const hasFilters = Boolean(sp.q || sp.status);

  // Summary counts from already-loaded rows (no extra query).
  const statusCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader title={t("title")} description={t("description")}>
        <Button asChild>
          <Link href="/proposals/new">
            <Plus className="mr-2 size-4" />
            {t("newProposal")}
          </Link>
        </Button>
      </PageHeader>

      {/* Summary header — total + by-status, derived from loaded rows. */}
      {rows.length > 0 && (
        <Card className="card-elevated">
          <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
            <div>
              <p className="text-2xl font-bold tracking-tight tabular-nums">
                {rows.length}
              </p>
              <p className="text-muted-foreground text-sm">
                {rows.length === ROW_CAP
                  ? t("showingFirst", { count: ROW_CAP })
                  : t("totalProposals")}
              </p>
            </div>
            <div className="bg-border hidden h-10 w-px sm:block" />
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {PRODUCT_STATUSES.map((s) => {
                const meta = PRODUCT_STATUS_META[s];
                return (
                  <div key={s} className="flex items-center gap-2">
                    <StatusBadge label={meta.label} tone={meta.badgeClass} />
                    <span className="text-sm font-semibold tabular-nums">
                      {statusCounts[s] ?? 0}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <form className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder={t("searchPlaceholder")}
          className="sm:max-w-xs"
        />
        <Select
          name="status"
          defaultValue={sp.status ?? ""}
          className="sm:max-w-[170px]"
        >
          <option value="">{t("allStatuses")}</option>
          {PRODUCT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PRODUCT_STATUS_META[s].label}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          {t("filter")}
        </Button>
        {hasFilters && (
          <Button asChild variant="ghost">
            <Link href="/proposals">{t("clear")}</Link>
          </Button>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={hasFilters ? t("noMatch") : t("noProposals")}
          description={
            hasFilters ? t("noMatchDescription") : t("noProposalsDescription")
          }
          action={
            !hasFilters && (
              <Button asChild>
                <Link href="/proposals/new">
                  <Plus className="mr-2 size-4" />
                  {t("newProposal")}
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <Card className="card-elevated overflow-hidden p-0">
          <div className="max-h-[70vh] overflow-auto">
            <Table>
              <TableHeader sticky>
                <TableRow className="hover:bg-transparent">
                  <SortHead href={sortHref("reference")} dir={dirFor("reference")}>
                    {t("table.reference")}
                  </SortHead>
                  <SortHead href={sortHref("title")} dir={dirFor("title")}>
                    {t("table.title")}
                  </SortHead>
                  <SortHead href={sortHref("client")} dir={dirFor("client")}>
                    {t("table.client")}
                  </SortHead>
                  <SortHead href={sortHref("status")} dir={dirFor("status")}>
                    {t("table.status")}
                  </SortHead>
                  <SortHead href={sortHref("total")} dir={dirFor("total")} numeric>
                    {t("table.total")}
                  </SortHead>
                  <SortHead href={sortHref("updated")} dir={dirFor("updated")} numeric>
                    {t("table.updated")}
                  </SortHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => {
                  const meta = PRODUCT_STATUS_META[p.status as ProductStatus];
                  return (
                    // Full-row navigation: an absolutely-positioned overlay Link
                    // makes the whole row a single click target (honest hover).
                    <TableRow key={p.id} className="group relative">
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        <Link
                          href={`/proposals/${p.id}`}
                          className="absolute inset-0 z-0"
                          aria-label={p.title}
                        />
                        <span className="relative z-10">{p.reference}</span>
                      </TableCell>
                      <TableCell>
                        <span className="relative z-10 block min-w-0">
                          <span className="block truncate font-medium group-hover:underline">
                            {p.title}
                          </span>
                          {p.destination && (
                            <span className="text-muted-foreground block truncate text-xs">
                              {p.destination}
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {p.clientName ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          label={meta?.label ?? p.status}
                          tone={meta?.badgeClass}
                        />
                      </TableCell>
                      <TableCell numeric className="font-medium tabular-nums">
                        {formatMoney(p.totalPrice, p.currency)}
                      </TableCell>
                      <TableCell numeric className="text-muted-foreground text-xs">
                        <span className="relative z-10 inline-flex items-center gap-1">
                          {formatDate(p.updatedAt)}
                          <ChevronRight className="text-muted-foreground/50 size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
