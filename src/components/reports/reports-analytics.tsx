import { eq, inArray } from "drizzle-orm";
import {
  TrendingUp,
  BarChart3,
  MapPin,
  Users,
  Filter,
  PieChart,
  CheckCircle2,
} from "lucide-react";
import { type StatDelta } from "@/components/app/stat-card";
import { StatStrip, StatStripSkeleton } from "@/components/app/stat-strip";
import {
  AreaInsight,
  DonutInsight,
  FunnelInsight,
  type DonutSlice,
} from "@/components/charts/insight-charts";
import { SectionCard } from "@/components/dashboard/section-card";
import { Badge } from "@/components/ui/badge";
import {
  conversionRate,
  growthPct,
  monthlyBuckets,
  num,
  topN,
} from "@/lib/analytics";
import { db } from "@/lib/db";
import { DEFAULT_CURRENCY, OPEN_STAGES } from "@/lib/domain";
import { formatMoney, formatMoneyCompact } from "@/lib/format";
import { paymentSummary } from "@/lib/payments/summary";
import { listTeamMembers } from "@/lib/queries";
import {
  inWindow,
  REPORT_PERIOD_PHRASE,
  type PeriodWindow,
  type ReportPeriod,
} from "@/lib/reports/period";
import { booking, opportunity, product, productItem } from "@/lib/schema";
import { cn } from "@/lib/utils";

const isDzd = (c: string | null | undefined) => (c || DEFAULT_CURRENCY) === DEFAULT_CURRENCY;
const isOpenStage = (s: string) =>
  OPEN_STAGES.includes(s as (typeof OPEN_STAGES)[number]);

/** Human labels for the product-item type codes (margin donut). */
const PRODUCT_TYPE_LABEL: Record<string, string> = {
  flight: "Flights",
  hotel: "Hotels & resorts",
  activity: "Activities",
  transfer: "Transfers",
  insurance: "Insurance",
  other: "Other",
};

/** Builds a delta pill from a percentage growth, or null when no baseline. */
function pctDelta(growth: number | null, caption: string): StatDelta | null {
  if (growth === null) return null;
  return {
    value: `${growth > 0 ? "+" : ""}${growth}%`,
    direction: growth >= 0 ? "up" : "down",
    caption,
  };
}

/** Builds a delta pill from a percentage-point change (already in pp). */
function ppDelta(deltaPp: number | null, caption: string): StatDelta | null {
  if (deltaPp === null) return null;
  const rounded = Math.round(deltaPp * 10) / 10;
  return {
    value: `${rounded > 0 ? "+" : ""}${rounded}pp`,
    direction: rounded >= 0 ? "up" : "down",
    caption,
  };
}

/** "Marrakech, Morocco" → "Morocco"; mirrors the dashboard's heuristic. */
const countryOf = (raw: string | null | undefined) =>
  raw
    ? raw.includes(",")
      ? raw.slice(raw.lastIndexOf(",") + 1).trim() || raw
      : raw
    : "Unknown";

/**
 * Reports & analytics dashboard. Computes every metric server-side, agency
 * scoped, in DZD only (no cross-currency sums), windowed by the chosen period.
 *
 * Gross profit & margin are derived from ACCEPTED PROPOSALS (`product`), the
 * only table that carries a real cost basis (`totalCost` vs `totalPrice`).
 * Bookings have no cost column, so booking-level margin cannot be computed —
 * see the report notes. When no accepted proposals exist in-window those two
 * KPIs render a muted "—" (the 6-up grid rhythm is always preserved) rather
 * than being dropped or fabricated.
 */
export async function ReportsAnalytics({
  agencyId,
  period,
  window: w,
}: {
  agencyId: string;
  period: ReportPeriod;
  window: PeriodWindow;
}) {
  // --- Load agency-scoped rows (lean column selections) --------------------
  const [bookings, opps, proposals, team] = await Promise.all([
    db.query.booking.findMany({
      where: eq(booking.agencyId, agencyId),
      columns: {
        status: true,
        currency: true,
        destination: true,
        totalAmount: true,
        clientId: true,
        createdById: true,
        createdAt: true,
      },
      with: { payments: { columns: { amount: true, kind: true, status: true } } },
    }),
    db
      .select({
        value: opportunity.value,
        currency: opportunity.currency,
        stage: opportunity.stage,
        probability: opportunity.probability,
        createdAt: opportunity.createdAt,
      })
      .from(opportunity)
      .where(eq(opportunity.agencyId, agencyId)),
    db
      .select({
        id: product.id,
        status: product.status,
        currency: product.currency,
        totalCost: product.totalCost,
        totalPrice: product.totalPrice,
        createdAt: product.createdAt,
      })
      .from(product)
      .where(eq(product.agencyId, agencyId)),
    listTeamMembers(agencyId),
  ]);

  // Bookings counted as revenue: confirmed/paid, DZD only.
  const isRevenueBooking = (b: { status: string; currency: string | null }) =>
    (b.status === "confirmed" || b.status === "paid") && isDzd(b.currency);
  const revenueBookings = bookings.filter(isRevenueBooking);

  const revenueIn = (from: Date, to: Date) =>
    revenueBookings
      .filter((b) => inWindow(b.createdAt, from, to))
      .reduce((s, b) => s + num(b.totalAmount), 0);

  // --- KPI 1: Revenue ------------------------------------------------------
  const revenueNow = revenueIn(w.from, w.to);
  const revenuePrev = revenueIn(w.prevFrom, w.prevTo);
  const revenueDelta = pctDelta(growthPct(revenueNow, revenuePrev), "vs prev period");

  // --- Accepted proposals (cost basis) -------------------------------------
  const acceptedProposals = proposals.filter((p) => p.status === "accepted");
  const dzdProposals = acceptedProposals.filter((p) => isDzd(p.currency));

  // --- KPI 2 & 5: Gross profit + Avg margin (from accepted proposals) ------
  const grossProfitIn = (from: Date, to: Date) =>
    dzdProposals
      .filter((p) => inWindow(p.createdAt, from, to))
      .reduce((s, p) => s + (num(p.totalPrice) - num(p.totalCost)), 0);
  const proposalRevenueIn = (from: Date, to: Date) =>
    dzdProposals
      .filter((p) => inWindow(p.createdAt, from, to))
      .reduce((s, p) => s + num(p.totalPrice), 0);

  const grossProfitNow = grossProfitIn(w.from, w.to);
  const grossProfitPrev = grossProfitIn(w.prevFrom, w.prevTo);
  const proposalRevenueNow = proposalRevenueIn(w.from, w.to);
  const hasCostBasis = proposalRevenueNow > 0;
  const grossProfitDelta = pctDelta(
    growthPct(grossProfitNow, grossProfitPrev),
    "vs prev period"
  );

  const marginNow = hasCostBasis ? (grossProfitNow / proposalRevenueNow) * 100 : 0;
  const proposalRevenuePrev = proposalRevenueIn(w.prevFrom, w.prevTo);
  const marginPrev = proposalRevenuePrev > 0 ? (grossProfitPrev / proposalRevenuePrev) * 100 : null;
  const marginDelta = ppDelta(
    marginPrev === null ? null : marginNow - marginPrev,
    "vs prev period"
  );

  // --- KPI 3: Bookings (all created in window) -----------------------------
  const bookingsNow = bookings.filter((b) => inWindow(b.createdAt, w.from, w.to)).length;
  const bookingsPrev = bookings.filter((b) => inWindow(b.createdAt, w.prevFrom, w.prevTo)).length;
  const bookingsDelta = pctDelta(growthPct(bookingsNow, bookingsPrev), "vs prev period");

  // --- KPI 4: Conversion (won ÷ closed deals created in window) ------------
  const closedIn = (from: Date, to: Date) =>
    opps.filter(
      (o) => (o.stage === "won" || o.stage === "lost") && inWindow(o.createdAt, from, to)
    );
  const closedNow = closedIn(w.from, w.to);
  const wonNow = closedNow.filter((o) => o.stage === "won").length;
  const convNow = conversionRate(wonNow, closedNow.length);
  const closedPrev = closedIn(w.prevFrom, w.prevTo);
  const wonPrev = closedPrev.filter((o) => o.stage === "won").length;
  const convPrev = closedPrev.length ? conversionRate(wonPrev, closedPrev.length) : null;
  const convDelta = ppDelta(convPrev === null ? null : convNow - convPrev, "search → booking");

  // --- KPI 6: Repeat rate (clients with ≥2 bookings ÷ ≥1, in window) -------
  const repeatRateIn = (from: Date, to: Date): number | null => {
    const counts = new Map<string, number>();
    for (const b of bookings) {
      if (!b.clientId || !inWindow(b.createdAt, from, to)) continue;
      counts.set(b.clientId, (counts.get(b.clientId) ?? 0) + 1);
    }
    const withAny = counts.size;
    if (!withAny) return null;
    const repeat = [...counts.values()].filter((n) => n >= 2).length;
    return conversionRate(repeat, withAny);
  };
  const repeatNow = repeatRateIn(w.from, w.to);
  const repeatPrev = repeatRateIn(w.prevFrom, w.prevTo);
  const repeatDelta = ppDelta(
    repeatNow !== null && repeatPrev !== null ? repeatNow - repeatPrev : null,
    "returning clients"
  );

  // --- Revenue trend (trailing 12 months, DZD confirmed/paid) --------------
  const revenueMonthly = monthlyBuckets(
    revenueBookings,
    (b) => b.createdAt,
    (b) => num(b.totalAmount),
    12,
    w.to
  );
  const trailingTotal = revenueMonthly.reduce((s, p) => s + p.value, 0);
  const peak = revenueMonthly.reduce(
    (best, p) => (p.value > best.value ? p : best),
    revenueMonthly[0] ?? { label: "—", value: 0 }
  );
  const avgPerMonth = revenueMonthly.length ? trailingTotal / revenueMonthly.length : 0;

  // --- Row 2a: Revenue by destination (in-window, DZD) ---------------------
  const inWindowRevenue = revenueBookings.filter((b) => inWindow(b.createdAt, w.from, w.to));
  const byDestination = topN(
    inWindowRevenue,
    (b) => countryOf(b.destination),
    (b) => num(b.totalAmount),
    8
  );
  const destinationCounts = new Map<string, number>();
  for (const b of inWindowRevenue) {
    const k = countryOf(b.destination);
    destinationCounts.set(k, (destinationCounts.get(k) ?? 0) + 1);
  }
  const destinationTotal = byDestination.reduce((s, d) => s + d.value, 0);
  const destinationMax = byDestination[0]?.value ?? 0;
  const bestRoute = byDestination[0]
    ? destinationTotal > 0
      ? `${byDestination[0].label} (${Math.round((byDestination[0].value / destinationTotal) * 1000) / 10}%)`
      : byDestination[0].label
    : "—";

  // --- Row 2b: Sales by agent (in-window revenue bookings, DZD) ------------
  const teamById = new Map(team.map((m) => [m.id, m]));
  const agentSales = new Map<string, { sales: number; deals: number }>();
  for (const b of inWindowRevenue) {
    if (!b.createdById) continue;
    const cur = agentSales.get(b.createdById) ?? { sales: 0, deals: 0 };
    cur.sales += num(b.totalAmount);
    cur.deals += 1;
    agentSales.set(b.createdById, cur);
  }
  const agents = [...agentSales.entries()]
    .map(([id, v]) => ({
      id,
      name: teamById.get(id)?.name ?? "Former member",
      role: teamById.get(id)?.role ?? null,
      sales: v.sales,
      deals: v.deals,
    }))
    .filter((a) => a.sales > 0)
    .sort((a, b) => b.sales - a.sales);
  const agentMax = agents[0]?.sales ?? 0;
  const teamTotal = agents.reduce((s, a) => s + a.sales, 0);

  // --- Row 3a: Pipeline funnel (real counts, this window) ------------------
  // search → proposal → won → booked, from real opportunity + proposal + booking
  // counts created in-window. Every stage is a genuine count (currency-agnostic).
  const oppsInWindow = opps.filter((o) => inWindow(o.createdAt, w.from, w.to)).length;
  const proposalsSent = proposals.filter(
    (p) =>
      (p.status === "sent" || p.status === "accepted" || p.status === "rejected") &&
      inWindow(p.createdAt, w.from, w.to)
  ).length;
  const proposalsAccepted = proposals.filter(
    (p) => p.status === "accepted" && inWindow(p.createdAt, w.from, w.to)
  ).length;
  const bookingsConfirmed = bookings.filter(
    (b) =>
      (b.status === "confirmed" || b.status === "paid") &&
      inWindow(b.createdAt, w.from, w.to)
  ).length;
  const funnel = [
    { label: "Opportunities", value: oppsInWindow },
    { label: "Proposals sent", value: proposalsSent },
    { label: "Proposals accepted", value: proposalsAccepted },
    { label: "Booked", value: bookingsConfirmed },
  ];
  const funnelHasData = funnel.some((f) => f.value > 0);
  const sentToAccepted = proposalsSent
    ? conversionRate(proposalsAccepted, proposalsSent)
    : null;
  const oppToProposal = oppsInWindow ? conversionRate(proposalsSent, oppsInWindow) : null;
  const endToEnd = oppsInWindow ? conversionRate(bookingsConfirmed, oppsInWindow) : null;

  // --- Row 3b: Margin by product type (accepted DZD proposals' items) ------
  // Real cost basis: sum (unitPrice − unitCost) × quantity per item TYPE across
  // accepted, DZD proposals in-window. Product-type mix is the true margin
  // contribution; no fabrication — types absent from the data simply don't show.
  const dzdAcceptedInWindow = dzdProposals.filter((p) => inWindow(p.createdAt, w.from, w.to));
  const acceptedIds = dzdAcceptedInWindow.map((p) => p.id);
  const items = acceptedIds.length
    ? await db
        .select({
          type: productItem.type,
          quantity: productItem.quantity,
          unitCost: productItem.unitCost,
          unitPrice: productItem.unitPrice,
          currency: productItem.currency,
        })
        .from(productItem)
        .where(inArray(productItem.productId, acceptedIds))
    : [];
  // Per-type margin (contribution) + margin % (profit ÷ price), DZD items only.
  const typeAgg = new Map<string, { profit: number; price: number }>();
  for (const it of items) {
    if (!isDzd(it.currency)) continue;
    const qty = it.quantity || 1;
    const profit = (num(it.unitPrice) - num(it.unitCost)) * qty;
    const price = num(it.unitPrice) * qty;
    const cur = typeAgg.get(it.type) ?? { profit: 0, price: 0 };
    cur.profit += profit;
    cur.price += price;
    typeAgg.set(it.type, cur);
  }
  const totalMarginContribution = [...typeAgg.values()].reduce(
    (s, v) => s + Math.max(0, v.profit),
    0
  );
  const marginByType: DonutSlice[] = [...typeAgg.entries()]
    .map(([type, v]) => ({
      type,
      profit: v.profit,
      productMargin: v.price > 0 ? Math.round((v.profit / v.price) * 1000) / 10 : 0,
    }))
    .filter((v) => v.profit > 0)
    .sort((a, b) => b.profit - a.profit)
    .map((v) => ({
      label: PRODUCT_TYPE_LABEL[v.type] ?? v.type,
      value: Math.round(v.profit),
      meta: `${v.productMargin}% product margin`,
      share:
        totalMarginContribution > 0
          ? Math.round((v.profit / totalMarginContribution) * 100)
          : 0,
    }));
  const totalItemProfit = [...typeAgg.values()].reduce((s, v) => s + v.profit, 0);
  const totalItemPrice = [...typeAgg.values()].reduce((s, v) => s + v.price, 0);
  const blendedMargin = totalItemPrice > 0 ? Math.round((totalItemProfit / totalItemPrice) * 1000) / 10 : 0;
  const topMarginLine = marginByType[0] ?? null;

  // --- Forecast card: weighted pipeline ------------------------------------
  const dzdOpps = opps.filter((o) => isDzd(o.currency));
  const openOpps = dzdOpps.filter((o) => isOpenStage(o.stage));
  const weightedForecast = openOpps.reduce(
    (s, o) => s + num(o.value) * (Math.min(100, Math.max(0, o.probability)) / 100),
    0
  );
  const openPipeline = openOpps.reduce((s, o) => s + num(o.value), 0);
  // Win rate across all closed deals (lifetime), for the forecast + glance cards.
  const wonAll = dzdOpps.filter((o) => o.stage === "won").length;
  const closedAll = dzdOpps.filter((o) => o.stage === "won" || o.stage === "lost").length;
  const winRate = conversionRate(wonAll, closedAll);
  // Forecast confidence: fraction of open-pipeline value carrying an explicit,
  // non-default probability — a real "how much of this is judged" signal.
  const forecastConfidence =
    openPipeline > 0
      ? Math.round(
          (openOpps
            .filter((o) => o.probability > 0 && o.probability !== 10)
            .reduce((s, o) => s + num(o.value), 0) /
            openPipeline) *
            100
        )
      : null;
  // Forecast vs current month's actual revenue, when both are available.
  const thisMonthRevenue = revenueMonthly[revenueMonthly.length - 1]?.value ?? 0;
  const forecastVs = growthPct(weightedForecast, thisMonthRevenue);
  const nextMonthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(new Date(w.to.getFullYear(), w.to.getMonth() + 1, 1));

  // --- "This period at a glance" -------------------------------------------
  const dzdActive = bookings.filter((b) => b.status !== "cancelled" && isDzd(b.currency));
  const avgBookingValue = dzdActive.length
    ? Math.round(dzdActive.reduce((s, b) => s + num(b.totalAmount), 0) / dzdActive.length)
    : 0;
  let outstanding = 0;
  for (const b of bookings) {
    if (!isDzd(b.currency)) continue;
    const { balance } = paymentSummary(b.payments, num(b.totalAmount));
    if (balance > 0) outstanding += balance;
  }

  // Pre-build optional delta props (project uses exactOptionalPropertyTypes).
  const d = (delta: StatDelta | null) => (delta ? { delta } : {});
  const periodPhrase = REPORT_PERIOD_PHRASE[period];

  return (
    <div className="space-y-6">
      {/* ============================ KPI ROW ============================ */}
      <StatStrip
        items={[
          {
            label: "Revenue",
            value: formatMoneyCompact(revenueNow),
            ...d(revenueDelta),
          },
          hasCostBasis
            ? {
                label: "Gross profit",
                value: formatMoneyCompact(grossProfitNow),
                ...d(grossProfitDelta),
              }
            : { label: "Gross profit", value: "—" },
          {
            label: "Bookings",
            value: bookingsNow.toLocaleString(),
            ...d(bookingsDelta),
          },
          {
            label: "Conversion",
            value: `${convNow}%`,
            ...d(convDelta),
          },
          hasCostBasis
            ? {
                label: "Avg margin",
                value: `${(Math.round(marginNow * 10) / 10).toLocaleString()}%`,
                ...d(marginDelta),
              }
            : { label: "Avg margin", value: "—" },
          {
            label: "Repeat rate",
            value: repeatNow === null ? "—" : `${repeatNow}%`,
            ...d(repeatDelta),
          },
        ]}
      />

      {/* ================= ROW 1: Revenue trend + side stack ================= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          icon={TrendingUp}
          title="Revenue trend"
          subtitle="Monthly confirmed revenue · trailing 12 months · DZD"
        >
          <AreaInsight data={revenueMonthly} format="currency" color="var(--chart-1)" />

          {/* 4-up mini-stat strip */}
          <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
            <MiniStat
              label="Peak month"
              value={`${formatMoneyCompact(peak.value)}`}
              sub={peak.label}
            />
            <MiniStat label="12-mo total" value={formatMoneyCompact(trailingTotal)} />
            <MiniStat label="Avg / month" value={formatMoneyCompact(avgPerMonth)} />
            <MiniStat label="Best route" value={bestRoute} sub="by revenue" />
          </div>
        </SectionCard>

        <div className="flex flex-col gap-6">
          {/* Dark forecast card */}
          <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-[var(--navy)] to-[var(--ink)] p-6 text-white shadow-[var(--shadow-lg)]">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-10 -right-10 size-56 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, color-mix(in oklch, var(--brand) 35%, transparent) 0%, transparent 70%)",
              }}
            />
            <div className="relative z-10">
              <span className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-blue-300 uppercase">
                <BarChart3 className="size-3.5" />
                {nextMonthLabel} forecast
              </span>
              <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums">
                {formatMoneyCompact(weightedForecast)}
              </p>
              <p className="mt-2 max-w-[92%] text-sm leading-relaxed text-blue-100/80">
                Projected revenue, weighted on open-pipeline probability — Σ deal value ×
                win likelihood.
              </p>
              <div className="mt-5 flex gap-7">
                {forecastVs !== null && (
                  <ForecastStat
                    value={`${forecastVs > 0 ? "+" : ""}${forecastVs}%`}
                    label="vs this month"
                  />
                )}
                <ForecastStat value={formatMoneyCompact(openPipeline)} label="open pipeline" />
                <ForecastStat value={`${winRate}%`} label="win rate" />
              </div>
              {forecastConfidence !== null && (
                <div className="mt-5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11.5px] font-semibold text-blue-50 tabular-nums">
                    <CheckCircle2 className="size-3" />
                    {forecastConfidence}% pipeline judged
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* This period at a glance */}
          <SectionCard
            icon={BarChart3}
            title="This period at a glance"
            subtitle="Headline figures · DZD"
            className="grow"
            bodyClassName="space-y-1 py-2"
          >
            <GlanceRow
              badge="Pipeline"
              badgeTone="info"
              label="Open opportunities"
              value={formatMoney(openPipeline)}
            />
            <GlanceRow
              badge="Avg deal"
              badgeTone="success"
              label="Avg booking value"
              value={formatMoney(avgBookingValue)}
            />
            <GlanceRow
              badge="Receivable"
              badgeTone="warning"
              label="Outstanding balance"
              value={formatMoney(outstanding)}
            />
            <GlanceRow
              badge="Win rate"
              badgeTone="neutral"
              label="Proposals accepted"
              value={`${winRate}%`}
            />
          </SectionCard>
        </div>
      </div>

      {/* ============= ROW 2: Revenue by destination + Sales by agent ============= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          icon={MapPin}
          title="Revenue by destination"
          subtitle="Top markets · share of confirmed revenue · DZD"
          action={
            <Badge variant="secondary" className="shrink-0">
              By revenue
            </Badge>
          }
          bodyClassName="space-y-0.5"
        >
          {byDestination.length === 0 ? (
            <EmptyPanel hint="No confirmed revenue in this window yet." />
          ) : (
            byDestination.map((dst, i) => (
              <HBarRow
                key={dst.label}
                label={dst.label}
                count={destinationCounts.get(dst.label) ?? 0}
                value={formatMoneyCompact(dst.value)}
                share={
                  destinationTotal > 0
                    ? Math.round((dst.value / destinationTotal) * 1000) / 10
                    : 0
                }
                widthPct={destinationMax > 0 ? (dst.value / destinationMax) * 100 : 0}
                color={`var(--chart-${(i % 6) + 1})`}
              />
            ))
          )}
        </SectionCard>

        <SectionCard
          icon={Users}
          title="Sales by agent"
          subtitle={`Confirmed revenue by owner · ${periodPhrase} · DZD`}
          action={
            <Badge variant="secondary" className="shrink-0">
              {agents.length} {agents.length === 1 ? "seller" : "sellers"}
            </Badge>
          }
          bodyClassName="space-y-0"
        >
          {agents.length === 0 ? (
            <EmptyPanel hint="No confirmed bookings attributed to an owner yet." />
          ) : (
            <>
              {agents.map((a, i) => (
                <AgentRow
                  key={a.id}
                  name={a.name}
                  role={a.role}
                  deals={a.deals}
                  sales={formatMoneyCompact(a.sales)}
                  widthPct={agentMax > 0 ? (a.sales / agentMax) * 100 : 0}
                  shareOfTop={agentMax > 0 ? Math.round((a.sales / agentMax) * 100) : 0}
                  color={`var(--chart-${(i % 6) + 1})`}
                />
              ))}
              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <span className="text-muted-foreground text-sm">
                  Team total · {periodPhrase}
                </span>
                <span className="text-[15px] font-semibold tabular-nums">
                  {formatMoneyCompact(teamTotal)}
                </span>
              </div>
            </>
          )}
        </SectionCard>
      </div>

      {/* ============= ROW 3: Pipeline funnel + Margin by product type ============= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          icon={Filter}
          title="Pipeline funnel"
          subtitle={`Opportunity → booking · ${periodPhrase}`}
          action={
            endToEnd !== null ? (
              <Badge variant="info" className="shrink-0">
                {endToEnd}% end-to-end
              </Badge>
            ) : undefined
          }
        >
          {funnelHasData ? (
            <>
              <FunnelInsight data={funnel} />
              <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4 text-center">
                <FunnelStat value={oppToProposal} label="Opp → proposal" />
                <FunnelStat value={sentToAccepted} label="Sent → accepted" tone="success" />
                <FunnelStat value={endToEnd} label="End-to-end" />
              </div>
            </>
          ) : (
            <EmptyPanel hint="No opportunities, proposals or bookings in this window yet." />
          )}
        </SectionCard>

        <SectionCard
          icon={PieChart}
          title="Margin by product type"
          subtitle={
            blendedMargin > 0
              ? `Gross margin contribution · blended ${blendedMargin}%`
              : "Gross margin contribution · accepted proposals · DZD"
          }
          action={
            <Badge variant="secondary" className="shrink-0">
              Accepted · DZD
            </Badge>
          }
        >
          {marginByType.length === 0 ? (
            <EmptyPanel hint="Accepted DZD proposals with itemised cost feed this donut." />
          ) : (
            <>
              <DonutInsight
                data={marginByType}
                format="currency"
                centerValue={`${blendedMargin}%`}
                centerLabel="blended margin"
              />
              {topMarginLine && (
                <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm">
                  <span className="text-muted-foreground">Highest-margin line</span>
                  <span className="font-semibold">
                    {topMarginLine.label} · {topMarginLine.meta?.replace(" product margin", "")}
                  </span>
                </div>
              )}
            </>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-muted-foreground truncate text-xs">{sub}</p>}
    </div>
  );
}

function ForecastStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-base font-bold tracking-tight tabular-nums">{value}</p>
      <p className="text-xs text-blue-200/70">{label}</p>
    </div>
  );
}

function GlanceRow({
  badge,
  badgeTone,
  label,
  value,
}: {
  badge: string;
  badgeTone: "info" | "success" | "warning" | "neutral";
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      {badgeTone === "neutral" ? (
        <Badge variant="secondary" dot className="shrink-0">
          {badge}
        </Badge>
      ) : (
        <Badge variant={badgeTone} dot className="shrink-0">
          {badge}
        </Badge>
      )}
      <span className="text-muted-foreground flex-1 truncate text-sm">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/** Horizontal destination bar row (label · count · track · value · share). */
function HBarRow({
  label,
  count,
  value,
  share,
  widthPct,
  color,
}: {
  label: string;
  count: number;
  value: string;
  share: number;
  widthPct: number;
  color: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(84px,auto)_1fr_auto] items-center gap-3 py-1.5">
      <span className="truncate text-[12.5px] font-medium">
        {label}
        {count > 0 && <span className="text-muted-foreground ml-1.5 text-[11px]">{count}</span>}
      </span>
      <span className="bg-muted h-[22px] overflow-hidden rounded-sm">
        <span
          className="block h-full rounded-sm transition-all"
          style={{ width: `${Math.max(widthPct, 2)}%`, backgroundColor: color }}
        />
      </span>
      <span className="text-right text-[12.5px] font-semibold tabular-nums">
        {value}
        <span className="text-muted-foreground ml-1.5 text-[11px] font-normal">{share}%</span>
      </span>
    </div>
  );
}

/** One agent leaderboard row: identity, sales-vs-top progress bar, deal count. */
function AgentRow({
  name,
  role,
  deals,
  sales,
  widthPct,
  shareOfTop,
  color,
}: {
  name: string;
  role: string | null;
  deals: number;
  sales: string;
  widthPct: number;
  shareOfTop: number;
  color: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold uppercase">
            {initialsOf(name)}
          </span>
          <div className="min-w-0 truncate text-[13px]">
            <span className="font-semibold">{name}</span>
            <span className="text-muted-foreground text-xs">
              {role ? ` · ${role}` : ""} · {deals} {deals === 1 ? "booking" : "bookings"}
            </span>
          </div>
        </div>
        <div className="mt-1.5">
          <span className="bg-muted block h-2 overflow-hidden rounded-full">
            <span
              className="block h-full rounded-full transition-all"
              style={{ width: `${Math.max(widthPct, 3)}%`, backgroundColor: color }}
            />
          </span>
          <p className="text-muted-foreground mt-1 text-[11px] tabular-nums">
            {shareOfTop}% of top seller
          </p>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[13px] font-semibold tabular-nums">{sales}</div>
      </div>
    </div>
  );
}

function FunnelStat({
  value,
  label,
  tone,
}: {
  value: number | null;
  label: string;
  tone?: "success";
}) {
  return (
    <div>
      <div
        className={cn(
          "text-lg font-bold tabular-nums",
          tone === "success" && value !== null && "text-success"
        )}
      >
        {value === null ? "—" : `${value}%`}
      </div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}

/** Compact, designed empty state for an analytics panel body. */
function EmptyPanel({ hint }: { hint: string }) {
  return (
    <div className="text-muted-foreground flex h-56 flex-col items-center justify-center gap-3 text-center">
      <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full">
        <BarChart3 className="size-5" />
      </span>
      <div className="space-y-0.5">
        <p className="text-foreground text-sm font-medium">Nothing to show yet</p>
        <p className="mx-auto max-w-[16rem] text-xs">{hint}</p>
      </div>
    </div>
  );
}

/** Two-letter initials from a display name (local to avoid a client import). */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Mirrors the analytics layout while the queries resolve. */
export function ReportsAnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <StatStripSkeleton cells={6} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card-elevated h-80 animate-pulse rounded-lg border bg-card lg:col-span-2" />
        <div className="card-elevated h-80 animate-pulse rounded-lg border bg-card" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card-elevated h-72 animate-pulse rounded-lg border bg-card" />
        <div className="card-elevated h-72 animate-pulse rounded-lg border bg-card" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card-elevated h-72 animate-pulse rounded-lg border bg-card" />
        <div className="card-elevated h-72 animate-pulse rounded-lg border bg-card" />
      </div>
    </div>
  );
}
