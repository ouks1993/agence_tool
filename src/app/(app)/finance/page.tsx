import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import {
  Wallet,
  CircleDollarSign,
  TrendingUp,
  AlertTriangle,
  Receipt,
  BadgePercent,
  CheckCircle2,
  Layers,
  Building2,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CurrencyNote } from "@/components/app/currency-note";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard, type StatDelta } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import {
  AreaInsight,
  BarInsight,
  DonutInsight,
  HBarInsight,
  type Point,
} from "@/components/charts/insight-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCommissionSummary } from "@/lib/actions/commissions";
import {
  agingBuckets,
  growthPct,
  headlineTotal,
  num,
  otherCurrencies,
  sumByCurrency,
  topN,
} from "@/lib/analytics";
import { db } from "@/lib/db";
import {
  canViewFinance,
  DEFAULT_CURRENCY,
  roleHome,
  PAYMENT_KIND_LABEL,
  type PaymentKind,
} from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { paymentSummary } from "@/lib/payments/summary";
import { requireAgencyUser } from "@/lib/permissions";
import { booking, commission, opportunity, payment, product, supplier } from "@/lib/schema";

export const metadata = { title: "Finance" };

const isBase = (c: string | null | undefined) =>
  (c || DEFAULT_CURRENCY) === DEFAULT_CURRENCY;

/** Delta pill from a % growth, or nothing (project uses exactOptionalPropertyTypes). */
function pctDelta(growth: number | null, caption: string): StatDelta | null {
  if (growth === null) return null;
  return {
    value: `${growth > 0 ? "+" : ""}${growth}%`,
    direction: growth >= 0 ? "up" : "down",
    caption,
  };
}

export default async function FinancePage() {
  const user = await requireAgencyUser();

  // Access gate: the Finance workspace is for finance, admin and manager roles.
  // Anyone else is sent to their own role's landing page.
  if (!canViewFinance(user.role)) redirect(roleHome(user.role));

  const t = await getTranslations("finance");

  // --- Bookings (agency-scoped via booking.agencyId) ----------------------
  // Pull every booking for the agency with its payments + client name. We
  // derive accounts-receivable, collected totals and confirmed revenue from
  // this single agency-scoped query, computing balances in code with
  // `paymentSummary`. Payments have no agencyId, so scoping flows through the
  // parent booking.
  const bookings = await db.query.booking.findMany({
    where: eq(booking.agencyId, user.agencyId),
    with: {
      payments: true,
      client: { columns: { name: true } },
    },
    limit: 1000,
  });

  const now = new Date();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // Per-booking AR computed from completed payments (refunds subtracted). We
  // keep the booking's own currency so every downstream rollup can group by it —
  // a booking priced in EUR must never be added into the DZD headline.
  const receivables = bookings
    .filter((b) => b.status !== "cancelled")
    .map((b) => {
      const total = parseFloat(b.totalAmount || "0");
      const { paid, balance } = paymentSummary(b.payments, total);
      const currency = b.currency || DEFAULT_CURRENCY;
      const isOverdue =
        !!b.departDate && new Date(b.departDate) < now && balance > 0.005;
      return { booking: b, total, paid, balance, currency, isOverdue };
    });

  // ── Currency-safe money rollups ─────────────────────────────────────────
  // NEVER sum across currencies. Each headline figure is grouped by currency
  // via `sumByCurrency`; the KPI shows the base-currency (DZD) `headlineTotal`
  // and any other currencies are surfaced explicitly beneath it, never blended.

  // Outstanding balance: positive balances, grouped by currency.
  const outstandingByCur = sumByCurrency(
    receivables,
    (r) => Math.max(r.balance, 0),
    (r) => r.currency
  );
  const outstandingBalance = headlineTotal(outstandingByCur);
  const outstandingOther = otherCurrencies(outstandingByCur);

  // Collected: completed payments minus refunds, grouped by each payment's currency.
  const paymentRows = bookings.flatMap((b) => b.payments);
  const collectedByCur = sumByCurrency(
    paymentRows.filter((p) => p.status === "completed"),
    (p) => (p.kind === "refund" ? -parseFloat(p.amount || "0") : parseFloat(p.amount || "0")),
    (p) => p.currency || DEFAULT_CURRENCY
  );
  const collected = headlineTotal(collectedByCur);
  const collectedOther = otherCurrencies(collectedByCur);

  // Confirmed revenue: confirmed/paid bookings, grouped by booking currency.
  const confirmedBookings = bookings.filter(
    (b) => b.status === "confirmed" || b.status === "paid"
  );
  const confirmedByCur = sumByCurrency(
    confirmedBookings,
    (b) => parseFloat(b.totalAmount || "0"),
    (b) => b.currency || DEFAULT_CURRENCY
  );
  const confirmedRevenue = headlineTotal(confirmedByCur);
  const confirmedOther = otherCurrencies(confirmedByCur);

  // Period-over-period deltas (base currency only) for the KPI trend pills.
  const collectedThisMonth = paymentRows
    .filter(
      (p) =>
        p.status === "completed" &&
        isBase(p.currency) &&
        new Date(p.createdAt) >= new Date(now.getFullYear(), now.getMonth(), 1)
    )
    .reduce(
      (s, p) => s + (p.kind === "refund" ? -num(p.amount) : num(p.amount)),
      0
    );
  const collectedPrevMonth = paymentRows
    .filter((p) => {
      if (p.status !== "completed" || !isBase(p.currency)) return false;
      const d = new Date(p.createdAt);
      return (
        d >= new Date(now.getFullYear(), now.getMonth() - 1, 1) &&
        d <= lastMonthEnd
      );
    })
    .reduce(
      (s, p) => s + (p.kind === "refund" ? -num(p.amount) : num(p.amount)),
      0
    );
  const collectedDelta = pctDelta(
    growthPct(collectedThisMonth, collectedPrevMonth),
    "this month"
  );

  const confirmedThisMonth = confirmedBookings
    .filter(
      (b) =>
        isBase(b.currency) &&
        new Date(b.createdAt) >= new Date(now.getFullYear(), now.getMonth(), 1)
    )
    .reduce((s, b) => s + num(b.totalAmount), 0);
  const confirmedPrevMonth = confirmedBookings
    .filter((b) => {
      if (!isBase(b.currency)) return false;
      const d = new Date(b.createdAt);
      return (
        d >= new Date(now.getFullYear(), now.getMonth() - 1, 1) &&
        d <= lastMonthEnd
      );
    })
    .reduce((s, b) => s + num(b.totalAmount), 0);
  const confirmedDelta = pctDelta(
    growthPct(confirmedThisMonth, confirmedPrevMonth),
    "this month"
  );

  // Accounts receivable: outstanding (balance > 0), soonest departure first.
  const arRows = receivables
    .filter((r) => r.balance > 0.005)
    .sort((a, b) => {
      const da = a.booking.departDate
        ? new Date(a.booking.departDate).getTime()
        : Infinity;
      const dbb = b.booking.departDate
        ? new Date(b.booking.departDate).getTime()
        : Infinity;
      return da - dbb;
    });

  const overdueCount = receivables.filter((r) => r.isOverdue).length;

  // --- Recent payments (agency-scoped through the parent booking) ----------
  // Join payment → booking and filter by booking.agencyId so we never leak
  // another tenant's payments. Only completed payments, most recent first.
  const recentPayments = await db
    .select({
      id: payment.id,
      amount: payment.amount,
      kind: payment.kind,
      method: payment.method,
      currency: payment.currency,
      createdAt: payment.createdAt,
      bookingId: payment.bookingId,
      reference: booking.reference,
    })
    .from(payment)
    .innerJoin(booking, eq(payment.bookingId, booking.id))
    .where(
      and(
        eq(booking.agencyId, user.agencyId),
        eq(payment.status, "completed")
      )
    )
    .orderBy(desc(payment.createdAt))
    .limit(15);

  // --- Chart data (derived in-memory from the agency-scoped bookings) ------
  // Charts render a SINGLE currency (the base, DZD) so a bar/donut never mixes
  // currencies. We flatten only base-currency completed payments; refunds kept
  // (subtracted) so we can net them out. No new query.
  type CompletedPayment = {
    amount: number;
    method: string;
    kind: string;
    createdAt: Date;
  };
  const completedPayments: CompletedPayment[] = [];
  for (const b of bookings) {
    if (!isBase(b.currency)) continue; // base-currency bookings only for charts
    for (const p of b.payments) {
      if (p.status !== "completed" || !isBase(p.currency)) continue;
      completedPayments.push({
        amount: parseFloat(p.amount || "0"),
        method: p.method,
        kind: p.kind,
        createdAt: new Date(p.createdAt),
      });
    }
  }

  // Signed amount: refunds reduce collected cash, so they count negative.
  const signedAmount = (p: CompletedPayment) =>
    p.kind === "refund" ? -p.amount : p.amount;

  // 1) Collected over time — last 6 months, chronological, net of refunds (DZD).
  const MONTHS_BACK = 6;
  const SHORT_MONTH = new Intl.DateTimeFormat("en-GB", { month: "short" });
  // Pre-seed the 6 buckets so empty months still render at zero (and in order).
  const monthBuckets: { key: string; label: string; value: number }[] = [];
  const bucketIndex = new Map<string, number>();
  for (let i = MONTHS_BACK - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    bucketIndex.set(key, monthBuckets.length);
    monthBuckets.push({ key, label: SHORT_MONTH.format(d), value: 0 });
  }
  for (const p of completedPayments) {
    const key = `${p.createdAt.getFullYear()}-${p.createdAt.getMonth()}`;
    const idx = bucketIndex.get(key);
    if (idx === undefined) continue; // older than the window — skip
    monthBuckets[idx]!.value += signedAmount(p);
  }
  const collectedOverTime: Point[] = monthBuckets.map((m) => ({
    label: m.label,
    value: Math.round(m.value * 100) / 100,
  }));
  const collectedTrailing = collectedOverTime.reduce((s, p) => s + p.value, 0);
  const collectedPeak = collectedOverTime.reduce(
    (best, p) => (p.value > best.value ? p : best),
    collectedOverTime[0] ?? { label: "—", value: 0 }
  );

  // 2) Payments by method — completed amounts grouped by method, net of refunds (DZD).
  const PAYMENT_METHODS = [
    "manual",
    "card",
    "transfer",
    "cash",
    "stripe",
  ] as const;
  const methodTotals = new Map<string, number>(
    PAYMENT_METHODS.map((m) => [m, 0])
  );
  for (const p of completedPayments) {
    methodTotals.set(p.method, (methodTotals.get(p.method) ?? 0) + signedAmount(p));
  }
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const paymentsByMethod: Point[] = [...methodTotals.entries()]
    .filter(([, value]) => value > 0.005)
    .map(([method, value]) => ({
      label: capitalize(method),
      value: Math.round(value * 100) / 100,
    }));
  const paymentsByMethodTotal = paymentsByMethod.reduce((s, p) => s + p.value, 0);

  // 3) Outstanding vs collected — two agency-wide base-currency totals.
  const outstandingVsCollected: Point[] = [
    { label: "Collected", value: Math.round(collected * 100) / 100 },
    {
      label: "Outstanding",
      value: Math.round(outstandingBalance * 100) / 100,
    },
  ];

  // 4) AR aging — outstanding balances bucketed by days past departure (DZD).
  const arAging: Point[] = agingBuckets(
    receivables
      .filter((r) => isBase(r.currency))
      .map((r) => ({ balance: r.balance, refDate: r.booking.departDate })),
    now
  );
  const arAgingOverdue = arAging
    .filter((b) => b.label !== "Not due")
    .reduce((s, b) => s + b.value, 0);

  // --- Revenue summary extras (each query agency-scoped) -------------------
  // Agency margin proxy: sum of (totalPrice - totalCost) across the agency's
  // products, grouped by product currency (base headline only). Won opportunity
  // value: sum of opportunity.value where stage=won, grouped by currency.
  const [products, wonOpportunities, commissionSummary] = await Promise.all([
    db.query.product.findMany({
      where: eq(product.agencyId, user.agencyId),
      columns: { totalPrice: true, totalCost: true, currency: true },
      limit: 1000,
    }),
    db.query.opportunity.findMany({
      where: and(
        eq(opportunity.agencyId, user.agencyId),
        eq(opportunity.stage, "won")
      ),
      columns: { value: true, currency: true },
      limit: 1000,
    }),
    getCommissionSummary(),
  ]);

  // Commission KPIs: prefer EUR, else fall back to whatever currency is first.
  const commissionCurrency =
    commissionSummary.find((s) => s.currency === "EUR")?.currency ??
    commissionSummary[0]?.currency ??
    "EUR";
  const commissionTotals = commissionSummary
    .filter((s) => s.currency === commissionCurrency)
    .reduce(
      (acc, s) => ({
        pending: acc.pending + s.totalPending,
        earned: acc.earned + s.totalEarned,
        paid: acc.paid + s.totalPaid,
      }),
      { pending: 0, earned: 0, paid: 0 }
    );

  // Agency margin (base currency headline). Product currency defaults to DZD.
  const marginByCur = sumByCurrency(
    products,
    (p) => parseFloat(p.totalPrice || "0") - parseFloat(p.totalCost || "0"),
    (p) => p.currency || DEFAULT_CURRENCY
  );
  const agencyMargin = headlineTotal(marginByCur);

  const wonByCur = sumByCurrency(
    wonOpportunities,
    (o) => parseFloat(o.value || "0"),
    (o) => o.currency || DEFAULT_CURRENCY
  );
  const wonValue = headlineTotal(wonByCur);
  const wonOther = otherCurrencies(wonByCur);

  // Margin %: base-currency agency margin ÷ base-currency proposal price.
  const baseProducts = products.filter((p) => isBase(p.currency));
  const totalProposalPrice = baseProducts.reduce((s, p) => s + num(p.totalPrice), 0);
  const marginPct = totalProposalPrice
    ? Math.round((agencyMargin / totalProposalPrice) * 1000) / 10
    : 0;

  // Commission earned by supplier (supplier → agency, DZD), top 8.
  const supplierCommissions = await db
    .select({ amount: commission.amount, currency: commission.currency, name: supplier.name })
    .from(commission)
    .innerJoin(supplier, eq(commission.supplierId, supplier.id))
    .where(
      and(
        eq(commission.agencyId, user.agencyId),
        eq(commission.type, "supplier_to_agency")
      )
    );
  const commissionBySupplier: Point[] = topN(
    supplierCommissions.filter((c) => isBase(c.currency)),
    (c) => c.name,
    (c) => num(c.amount),
    8
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader title={t("title")} description={t("description")} />

      {/* KPIs — every headline is a single base-currency (DZD) figure; other
          currencies are surfaced explicitly, never blended into the total. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <StatCard
            label={`Outstanding balance (${DEFAULT_CURRENCY})`}
            value={formatMoney(outstandingBalance, DEFAULT_CURRENCY)}
            hint={`${arRows.length} booking${arRows.length === 1 ? "" : "s"} with a balance`}
            icon={Wallet}
          />
          <CurrencyNote others={outstandingOther} prefix="also outstanding" />
        </div>
        <div>
          <StatCard
            label={`Collected (${DEFAULT_CURRENCY})`}
            value={formatMoney(collected, DEFAULT_CURRENCY)}
            hint="Completed payments, net of refunds"
            icon={CircleDollarSign}
            {...(collectedDelta ? { delta: collectedDelta } : {})}
          />
          <CurrencyNote others={collectedOther} prefix="also collected" />
        </div>
        <div>
          <StatCard
            label={`Confirmed revenue (${DEFAULT_CURRENCY})`}
            value={formatMoney(confirmedRevenue, DEFAULT_CURRENCY)}
            hint="Confirmed & paid bookings"
            icon={TrendingUp}
            {...(confirmedDelta ? { delta: confirmedDelta } : {})}
          />
          <CurrencyNote others={confirmedOther} prefix="also" />
        </div>
        <StatCard
          label="Overdue"
          value={overdueCount}
          hint={overdueCount ? "Past departure, still owing" : "All on track"}
          icon={AlertTriangle}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="card-elevated">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4" /> Collected over time
              </CardTitle>
              <ChartLegend
                items={[{ label: "Net collected", color: "var(--chart-1)" }]}
              />
            </div>
          </CardHeader>
          <CardContent>
            <AreaInsight data={collectedOverTime} format="currency" />
            <ChartFooter
              stats={[
                { label: "6-mo total", value: formatMoney(collectedTrailing, DEFAULT_CURRENCY) },
                { label: "Peak", value: `${collectedPeak.label} · ${formatMoney(collectedPeak.value, DEFAULT_CURRENCY)}` },
              ]}
            />
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleDollarSign className="size-4" /> Payments by method
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DonutInsight data={paymentsByMethod} format="currency" />
            <ChartFooter
              stats={[
                { label: "Methods", value: String(paymentsByMethod.length) },
                { label: "Total", value: formatMoney(paymentsByMethodTotal, DEFAULT_CURRENCY) },
              ]}
            />
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="size-4" /> Outstanding vs collected
              </CardTitle>
              <ChartLegend
                items={[
                  { label: "Collected", color: "var(--chart-1)" },
                  { label: "Outstanding", color: "var(--chart-3)" },
                ]}
              />
            </div>
          </CardHeader>
          <CardContent>
            <BarInsight data={outstandingVsCollected} format="currency" />
            <ChartFooter
              stats={[
                { label: "Collected", value: formatMoney(collected, DEFAULT_CURRENCY) },
                { label: "Outstanding", value: formatMoney(outstandingBalance, DEFAULT_CURRENCY) },
              ]}
            />
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="size-4" /> Accounts receivable aging
              </CardTitle>
              <ChartLegend
                items={[{ label: "Balance", color: "var(--chart-4)" }]}
              />
            </div>
          </CardHeader>
          <CardContent>
            <BarInsight data={arAging} format="currency" color="var(--chart-4)" />
            <ChartFooter
              stats={[
                { label: "Overdue (30d+)", value: formatMoney(arAgingOverdue, DEFAULT_CURRENCY) },
                { label: "Total AR", value: formatMoney(outstandingBalance, DEFAULT_CURRENCY) },
              ]}
            />
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="size-4" /> Commission earned by supplier
              </CardTitle>
              <ChartLegend
                items={[{ label: "Earned", color: "var(--chart-2)" }]}
              />
            </div>
          </CardHeader>
          <CardContent>
            <HBarInsight data={commissionBySupplier} format="currency" color="var(--chart-2)" />
          </CardContent>
        </Card>
      </div>

      {/* Accounts receivable */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="size-4" /> Accounts receivable
          </CardTitle>
        </CardHeader>
        <CardContent>
          {arRows.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="All paid up"
              description="No outstanding balances. Every booking is fully paid."
            />
          ) : (
            <div className="max-h-[28rem] overflow-y-auto rounded-lg border">
              <Table zebra>
                <TableHeader sticky>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Departs</TableHead>
                    <TableHead numeric>Total</TableHead>
                    <TableHead numeric>Paid</TableHead>
                    <TableHead numeric>Balance</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {arRows.map((r) => {
                    const b = r.booking;
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          <Link
                            href={`/bookings/${b.id}`}
                            className="hover:underline"
                          >
                            {b.reference}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/bookings/${b.id}`}
                            className="font-medium hover:underline"
                          >
                            {b.client?.name ?? "—"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatDate(b.departDate)}
                        </TableCell>
                        <TableCell numeric>
                          {formatMoney(r.total, r.currency)}
                        </TableCell>
                        <TableCell numeric className="text-muted-foreground">
                          {formatMoney(r.paid, r.currency)}
                        </TableCell>
                        <TableCell numeric className="font-medium">
                          {formatMoney(r.balance, r.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.isOverdue && (
                            <StatusBadge label="Overdue" variant="danger" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent payments */}
        <Card className="card-elevated lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="size-4" /> Recent payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No payments yet"
                description="Completed payments recorded against this agency's bookings will appear here."
              />
            ) : (
              <div className="rounded-lg border">
                <Table zebra>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Booking</TableHead>
                      <TableHead>Kind</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead numeric>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPayments.map((p) => {
                      const isRefund = p.kind === "refund";
                      const amount = parseFloat(p.amount || "0");
                      // Refunds reduce collected cash, so we show them negative & red.
                      const signed = isRefund ? -amount : amount;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="text-muted-foreground text-xs">
                            {formatDate(p.createdAt)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            <Link
                              href={`/bookings/${p.bookingId}`}
                              className="hover:underline"
                            >
                              {p.reference}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {PAYMENT_KIND_LABEL[p.kind as PaymentKind] ?? p.kind}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm capitalize">
                            {p.method}
                          </TableCell>
                          <TableCell
                            numeric
                            className={
                              isRefund
                                ? "text-destructive font-medium"
                                : "font-medium"
                            }
                          >
                            {formatMoney(signed, p.currency)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue summary */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4" /> Revenue summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground text-sm">
                  Confirmed revenue
                </dt>
                <dd className="font-semibold tabular-nums">
                  {formatMoney(confirmedRevenue, DEFAULT_CURRENCY)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground text-sm">Collected</dt>
                <dd className="font-semibold tabular-nums">
                  {formatMoney(collected, DEFAULT_CURRENCY)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground text-sm">
                  Agency margin
                  <span className="text-muted-foreground/70 ml-1 text-xs">
                    (proposals)
                  </span>
                </dt>
                <dd className="font-semibold tabular-nums">
                  {formatMoney(agencyMargin, DEFAULT_CURRENCY)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground text-sm">
                  Margin
                  <span className="text-muted-foreground/70 ml-1 text-xs">
                    (% of price)
                  </span>
                </dt>
                <dd className="font-semibold tabular-nums">{marginPct}%</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground text-sm">
                  Won opportunities
                </dt>
                <dd className="font-semibold tabular-nums">
                  {formatMoney(wonValue, DEFAULT_CURRENCY)}
                </dd>
              </div>
            </dl>
            <CurrencyNote others={wonOther} prefix="won (other):" />
            <p className="text-muted-foreground/70 mt-4 text-xs">
              Figures in {DEFAULT_CURRENCY}. Agency margin is the sum of proposal
              price minus supplier cost across all products.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Commissions */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <BadgePercent className="size-5" /> Commissions
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label={`Pending (${commissionCurrency})`}
            value={formatMoney(commissionTotals.pending, commissionCurrency)}
            hint="Not yet earned"
            icon={Wallet}
          />
          <StatCard
            label={`Earned (${commissionCurrency})`}
            value={formatMoney(commissionTotals.earned, commissionCurrency)}
            hint="Earned, awaiting payout"
            icon={CircleDollarSign}
          />
          <StatCard
            label={`Paid (${commissionCurrency})`}
            value={formatMoney(commissionTotals.paid, commissionCurrency)}
            hint="Settled commissions"
            icon={CheckCircle2}
          />
        </div>
      </div>
    </div>
  );
}

/** Right-aligned legend row for a chart card header (swatch + label). */
function ChartLegend({
  items,
}: {
  items: { label: string; color: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map((it) => (
        <span
          key={it.label}
          className="text-muted-foreground flex items-center gap-1.5 text-xs"
        >
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ backgroundColor: it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Divider-topped summary strip below a chart (label + tabular value). */
function ChartFooter({
  stats,
}: {
  stats: { label: string; value: string }[];
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t pt-3">
      {stats.map((s) => (
        <div key={s.label} className="space-y-0.5">
          <p className="text-muted-foreground text-[11px] tracking-wide uppercase">
            {s.label}
          </p>
          <p className="text-sm font-semibold tabular-nums">{s.value}</p>
        </div>
      ))}
    </div>
  );
}
