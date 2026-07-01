import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgePercent, Wallet, CircleDollarSign, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusPill } from "@/components/app/status-badge";
import { RecordCommissionDialog } from "@/components/commissions/record-commission-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { getCommissions, getCommissionSummary } from "@/lib/actions/commissions";
import {
  canManagePayments,
  canViewFinance,
  COMMISSION_STATUS_META,
  COMMISSION_STATUSES,
  COMMISSION_TYPE_LABEL,
  COMMISSION_TYPES,
  type CommissionStatus,
  type CommissionType,
} from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { requireAgencyUser } from "@/lib/permissions";

export const metadata = { title: "Commissions" };

type SearchParams = Promise<{
  type?: string;
  status?: string;
  from?: string;
  to?: string;
}>;

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireAgencyUser();
  // Commissions are part of the finance workspace.
  if (!canViewFinance(user.role)) redirect("/dashboard");

  const sp = await searchParams;

  // Build a filter object without ever passing `undefined` explicitly — spread
  // each key only when it has a value (exactOptionalPropertyTypes-safe).
  const [commissions, summary] = await Promise.all([
    getCommissions({
      ...(sp.type && { type: sp.type as CommissionType }),
      ...(sp.status && { status: sp.status as CommissionStatus }),
      ...(sp.from && { dateFrom: sp.from }),
      ...(sp.to && { dateTo: sp.to }),
    }),
    getCommissionSummary(),
  ]);

  const hasFilters = Boolean(sp.type || sp.status || sp.from || sp.to);
  const canManage = canManagePayments(user.role);

  // Roll the per-currency summary rows up into one set of totals per currency.
  const byCurrency = new Map<
    string,
    { pending: number; earned: number; paid: number }
  >();
  for (const s of summary) {
    const acc = byCurrency.get(s.currency) ?? { pending: 0, earned: 0, paid: 0 };
    acc.pending += s.totalPending;
    acc.earned += s.totalEarned;
    acc.paid += s.totalPaid;
    byCurrency.set(s.currency, acc);
  }
  const summaryRows = [...byCurrency.entries()];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Commissions"
        description="Track commissions earned from suppliers and owed to agents."
      >
        {canManage && <RecordCommissionDialog />}
      </PageHeader>

      {/* Summary cards — one row of three per currency in play. Each currency is
          totalled independently; we never blend currencies into one figure. */}
      {summaryRows.length > 0 && (
        <div className="space-y-6">
          {summaryRows.map(([currency, totals]) => (
            <div key={currency} className="space-y-3">
              {summaryRows.length > 1 && (
                <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
                  {currency}
                  <span className="bg-border h-px flex-1" />
                </h2>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                  label={`Pending (${currency})`}
                  value={formatMoney(totals.pending, currency)}
                  hint="Not yet earned"
                  icon={Wallet}
                />
                <StatCard
                  label={`Earned (${currency})`}
                  value={formatMoney(totals.earned, currency)}
                  hint="Earned, awaiting payout"
                  icon={CircleDollarSign}
                />
                <StatCard
                  label={`Paid (${currency})`}
                  value={formatMoney(totals.paid, currency)}
                  hint="Settled commissions"
                  icon={CheckCircle2}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters — submitted as URL search params via a GET form. */}
      <form className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs" htmlFor="f-type">
            Type
          </label>
          <Select
            id="f-type"
            name="type"
            defaultValue={sp.type ?? ""}
            className="sm:max-w-[200px]"
          >
            <option value="">All types</option>
            {COMMISSION_TYPES.map((t) => (
              <option key={t} value={t}>
                {COMMISSION_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs" htmlFor="f-status">
            Status
          </label>
          <Select
            id="f-status"
            name="status"
            defaultValue={sp.status ?? ""}
            className="sm:max-w-[160px]"
          >
            <option value="">All statuses</option>
            {COMMISSION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {COMMISSION_STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs" htmlFor="f-from">
            From
          </label>
          <Input
            id="f-from"
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className="sm:max-w-[160px]"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-muted-foreground text-xs" htmlFor="f-to">
            To
          </label>
          <Input
            id="f-to"
            type="date"
            name="to"
            defaultValue={sp.to ?? ""}
            className="sm:max-w-[160px]"
          />
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {hasFilters && (
          <Button asChild variant="ghost">
            <Link href="/commissions">Clear</Link>
          </Button>
        )}
      </form>

      {commissions.length === 0 ? (
        <EmptyState
          icon={BadgePercent}
          title={
            hasFilters ? "No commissions match your filters" : "No commissions yet"
          }
          description={
            hasFilters
              ? "Try clearing the filters."
              : "Commissions recorded against bookings will appear here."
          }
        />
      ) : (
        <div className="card-elevated bg-card max-h-[36rem] overflow-y-auto rounded-lg border">
          <Table zebra>
            <TableHeader sticky>
              <TableRow>
                <TableHead>Booking</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Supplier / Agent</TableHead>
                <TableHead numeric>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.map((c) => {
                const statusMeta =
                  COMMISSION_STATUS_META[c.status as CommissionStatus];
                const typeLabel =
                  COMMISSION_TYPE_LABEL[c.type as CommissionType] ?? c.type;
                const party =
                  c.type === "supplier_to_agency"
                    ? c.supplierName
                    : c.agentName;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">
                      {c.bookingId ? (
                        <Link
                          href={`/bookings/${c.bookingId}`}
                          className="hover:underline"
                        >
                          {c.bookingRef ?? "—"}
                        </Link>
                      ) : (
                        (c.bookingRef ?? "—")
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="whitespace-nowrap">
                        {typeLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {party ?? "—"}
                    </TableCell>
                    <TableCell numeric className="font-medium">
                      {formatMoney(c.amount, c.currency)}
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        domain="commission"
                        status={c.status}
                        label={statusMeta?.label ?? c.status}
                        dot
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(c.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
