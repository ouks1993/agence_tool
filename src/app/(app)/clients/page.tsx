import Link from "next/link";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Plus,
  Users,
  Building2,
  User as UserIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-badge";
import { ClientAvatar } from "@/components/clients/client-avatar";
import { flagFor } from "@/components/clients/country-flag";
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
  CLIENT_STATUS_META,
  seesAllData,
  type ClientStatus,
} from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { requireAgencyUser } from "@/lib/permissions";
import { listTeamMembers } from "@/lib/queries";
import { client, opportunity } from "@/lib/schema";
import { cn } from "@/lib/utils";

export const metadata = { title: "Clients" };

type SearchParams = Promise<{
  q?: string;
  status?: string;
  owner?: string;
  sort?: string;
  dir?: string;
}>;

const STATUS_ORDER: ClientStatus[] = ["active", "lead", "inactive"];

// Sortable columns → the client column they order by. `opps` sorts client-side
// (derived count) so it is intentionally excluded here.
const SORTABLE = {
  name: client.name,
  type: client.type,
  status: client.status,
  location: client.country,
  updated: client.updatedAt,
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

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireAgencyUser();
  const t = await getTranslations("clients");
  const sp = await searchParams;
  const team = await listTeamMembers(user.agencyId);

  const conditions: SQL[] = [eq(client.agencyId, user.agencyId)];
  // Agents see only their own clients (admin/manager/finance/support see all).
  if (!seesAllData(user.role)) conditions.push(eq(client.ownerId, user.id));
  if (sp.q) {
    const q = or(
      ilike(client.name, `%${sp.q}%`),
      ilike(client.email, `%${sp.q}%`),
      ilike(client.company, `%${sp.q}%`)
    );
    if (q) conditions.push(q);
  }
  if (sp.status) conditions.push(eq(client.status, sp.status));
  if (sp.owner) conditions.push(eq(client.ownerId, sp.owner));
  const where = and(...conditions);

  // Sort: default to most-recently-updated; honour ?sort=&dir= for the header.
  const sortKey = (sp.sort && sp.sort in SORTABLE ? sp.sort : "updated") as SortKey;
  const sortDir: "asc" | "desc" =
    sp.dir === "asc" || sp.dir === "desc"
      ? sp.dir
      : sortKey === "updated"
        ? "desc"
        : "asc";
  const sortCol: SQLWrapper = SORTABLE[sortKey];
  const orderBy = sortDir === "asc" ? asc(sortCol) : desc(sortCol);

  const clients = await db.query.client.findMany({
    where,
    with: { owner: { columns: { name: true } } },
    orderBy: [orderBy, desc(client.updatedAt)],
    limit: 200,
  });

  // Build a sort-toggle href that preserves the active filters.
  const sortHref = (key: SortKey): string => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.status) params.set("status", sp.status);
    if (sp.owner) params.set("owner", sp.owner);
    params.set("sort", key);
    // Toggle direction when clicking the active column, else sensible default.
    const nextDir =
      sortKey === key
        ? sortDir === "asc"
          ? "desc"
          : "asc"
        : key === "updated"
          ? "desc"
          : "asc";
    params.set("dir", nextDir);
    return `/clients?${params.toString()}`;
  };
  const dirFor = (key: SortKey): SortDirection =>
    sortKey === key ? sortDir : false;

  // Opportunity counts per client.
  const counts = await db
    .select({
      clientId: opportunity.clientId,
      count: sql<number>`count(*)::int`,
    })
    .from(opportunity)
    .where(eq(opportunity.agencyId, user.agencyId))
    .groupBy(opportunity.clientId);
  const countMap = new Map(counts.map((c) => [c.clientId, c.count]));

  const hasFilters = Boolean(sp.q || sp.status || sp.owner);

  // Summary counts from already-loaded rows (no extra query).
  const statusCounts = clients.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader title={t("title")} description={t("description")}>
        <Button asChild>
          <Link href="/clients/new">
            <Plus className="mr-2 size-4" />
            {t("newClient")}
          </Link>
        </Button>
      </PageHeader>

      {/* Summary header — total + by-status, derived from loaded rows. */}
      {clients.length > 0 && (
        <Card className="card-elevated">
          <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
            <div>
              <p className="text-2xl font-bold tracking-tight tabular-nums">
                {clients.length}
              </p>
              <p className="text-muted-foreground text-sm">
                {clients.length === 200 ? "Showing first 200" : "Total clients"}
              </p>
            </div>
            <div className="bg-border hidden h-10 w-px sm:block" />
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {STATUS_ORDER.map((s) => {
                const meta = CLIENT_STATUS_META[s];
                return (
                  <div key={s} className="flex items-center gap-2">
                    <StatusPill domain="client" status={s} label={meta.label} />
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
          placeholder="Search name, email, company…"
          className="sm:max-w-xs"
        />
        <Select name="status" defaultValue={sp.status ?? ""} className="sm:max-w-[160px]">
          <option value="">{t("table.status")}</option>
          <option value="lead">{t("status.lead")}</option>
          <option value="active">{t("status.active")}</option>
          <option value="inactive">{t("status.inactive")}</option>
        </Select>
        <Select name="owner" defaultValue={sp.owner ?? ""} className="sm:max-w-[180px]">
          <option value="">All owners</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {hasFilters && (
          <Button asChild variant="ghost">
            <Link href="/clients">Clear</Link>
          </Button>
        )}
      </form>

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={hasFilters ? "No clients match your filters" : t("noClients")}
          description={
            hasFilters
              ? "Try clearing the filters."
              : "Add your first client to start building proposals."
          }
          action={
            !hasFilters && (
              <Button asChild>
                <Link href="/clients/new">
                  <Plus className="mr-2 size-4" />
                  {t("newClient")}
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
                  <SortHead href={sortHref("name")} dir={dirFor("name")}>
                    {t("table.name")}
                  </SortHead>
                  <SortHead href={sortHref("type")} dir={dirFor("type")}>
                    {t("table.type")}
                  </SortHead>
                  <SortHead href={sortHref("status")} dir={dirFor("status")}>
                    {t("table.status")}
                  </SortHead>
                  <SortHead href={sortHref("location")} dir={dirFor("location")}>
                    {t("list.location")}
                  </SortHead>
                  <TableHead>{t("list.owner")}</TableHead>
                  <TableHead numeric>{t("list.opps")}</TableHead>
                  <SortHead
                    href={sortHref("updated")}
                    dir={dirFor("updated")}
                    numeric
                  >
                    {t("list.updated")}
                  </SortHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => {
                  const statusMeta = CLIENT_STATUS_META[c.status as ClientStatus];
                  const isCorporate = c.type === "corporate";
                  const TypeIcon = isCorporate ? Building2 : UserIcon;
                  const flag = flagFor(c.country ?? c.city);
                  const location =
                    [c.city, c.country].filter(Boolean).join(", ") || "—";
                  return (
                    // Full-row navigation: an absolutely-positioned overlay Link
                    // makes the whole row a single click target (honest hover).
                    <TableRow key={c.id} className="group relative">
                      <TableCell>
                        <Link
                          href={`/clients/${c.id}`}
                          className="absolute inset-0 z-0"
                          aria-label={c.name}
                        />
                        <span className="relative z-10 flex items-center gap-3">
                          <ClientAvatar
                            name={c.name}
                            className="size-9 text-xs"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium group-hover:underline">
                              {c.name}
                            </span>
                            {c.email && (
                              <span className="text-muted-foreground block truncate text-xs">
                                {c.email}
                              </span>
                            )}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm capitalize">
                          <TypeIcon className="size-3.5" />
                          {c.type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusPill
                          domain="client"
                          status={c.status}
                          label={statusMeta?.label ?? c.status}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          {flag && (
                            <span aria-hidden className="text-base leading-none">
                              {flag}
                            </span>
                          )}
                          {location}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {c.owner?.name ?? t("list.unassigned")}
                      </TableCell>
                      <TableCell numeric className="font-medium">
                        {countMap.get(c.id) ?? 0}
                      </TableCell>
                      <TableCell
                        numeric
                        className="text-muted-foreground text-xs"
                      >
                        <span className="relative z-10 inline-flex items-center gap-1">
                          {formatDate(c.updatedAt)}
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
