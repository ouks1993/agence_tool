import Link from "next/link";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { Plus, Users, Building2, User as UserIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { ClientAvatar } from "@/components/clients/client-avatar";
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

export const metadata = { title: "Clients" };

type SearchParams = Promise<{ q?: string; status?: string; owner?: string }>;

const STATUS_ORDER: ClientStatus[] = ["active", "lead", "inactive"];

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

  const clients = await db.query.client.findMany({
    where,
    with: { owner: { columns: { name: true } } },
    orderBy: [desc(client.updatedAt)],
    limit: 200,
  });

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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("table.name")}</TableHead>
                  <TableHead>{t("table.type")}</TableHead>
                  <TableHead>{t("table.status")}</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Opps</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => {
                  const statusMeta = CLIENT_STATUS_META[c.status as ClientStatus];
                  const isCorporate = c.type === "corporate";
                  const TypeIcon = isCorporate ? Building2 : UserIcon;
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link
                          href={`/clients/${c.id}`}
                          className="flex items-center gap-3 group"
                        >
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
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm capitalize">
                          <TypeIcon className="size-3.5" />
                          {c.type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          label={statusMeta?.label ?? c.status}
                          tone={statusMeta?.badgeClass}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {c.owner?.name ?? "Unassigned"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {countMap.get(c.id) ?? 0}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs tabular-nums">
                        {formatDate(c.updatedAt)}
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
