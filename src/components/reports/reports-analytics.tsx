import { and, eq } from "drizzle-orm";
import {
  Wallet,
  Coins,
  Briefcase,
  Percent,
  TrendingUp,
  Repeat,
  BarChart3,
} from "lucide-react";
import { StatCard, type StatDelta } from "@/components/app/stat-card";
import { AreaInsight } from "@/components/charts/insight-charts";
import { SectionCard } from "@/components/dashboard/section-card";
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
import {
  inWindow,
  REPORT_PERIOD_PHRASE,
  type PeriodWindow,
  type ReportPeriod,
} from "@/lib/reports/period";
import { booking, opportunity, product } from "@/lib/schema";

const isDzd = (c: string | null | undefined) => (c || DEFAULT_CURRENCY) === DEFAULT_CURRENCY;
const isOpenStage = (s: string) =>
  OPEN_STAGES.includes(s as (typeof OPEN_STAGES)[number]);

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
 * KPIs are omitted rather than fabricated.
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
  const [bookings, opps, proposals] = await Promise.all([
    db.query.booking.findMany({
      where: eq(booking.agencyId, agencyId),
      columns: {
        status: true,
        currency: true,
        destination: true,
        totalAmount: true,
        clientId: true,
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
        status: product.status,
        currency: product.currency,
        totalCost: product.totalCost,
        totalPrice: product.totalPrice,
        createdAt: product.createdAt,
      })
      .from(product)
      .where(and(eq(product.agencyId, agencyId), eq(product.status, "accepted"))),
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

  // --- KPI 2 & 5: Gross profit + Avg margin (from accepted proposals) ------
  const dzdProposals = proposals.filter((p) => isDzd(p.currency));
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
  const byDestination = topN(
    revenueBookings.filter((b) => inWindow(b.createdAt, w.from, w.to)),
    (b) => countryOf(b.destination),
    (b) => num(b.totalAmount),
    1
  );
  const bestRoute = byDestination[0]?.label ?? "—";

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
  // Forecast vs current month's actual revenue, when both are available.
  const thisMonthRevenue = revenueMonthly[revenueMonthly.length - 1]?.value ?? 0;
  const forecastVs = growthPct(weightedForecast, thisMonthRevenue);

  // --- "This period at a glance" -------------------------------------------
  const dzdActive = bookings.filter((b) => b.status !== "cancelled" && isDzd(b.currency));
  const avgBookingValue = dzdActive.length
    ? Math.round(dzdActive.reduce((s, b) => s + num(b.totalAmount), 0) / dzdActive.length)
    : 0;
  let outstanding = 0;
  for (const b of bookings) {
    const { balance } = paymentSummary(b.payments, num(b.totalAmount));
    if (balance > 0) outstanding += balance;
  }

  // Pre-build optional delta props (project uses exactOptionalPropertyTypes).
  const d = (delta: StatDelta | null) => (delta ? { delta } : {});
  const periodPhrase = REPORT_PERIOD_PHRASE[period];

  return (
    <div className="space-y-6">
      {/* ============================ KPI ROW ============================ */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Revenue"
          value={formatMoneyCompact(revenueNow)}
          icon={Wallet}
          hint="Confirmed & paid · DZD"
          {...d(revenueDelta)}
        />
        {hasCostBasis ? (
          <StatCard
            label="Gross profit"
            value={formatMoneyCompact(grossProfitNow)}
            icon={Coins}
            hint="Accepted proposals"
            {...d(grossProfitDelta)}
          />
        ) : null}
        <StatCard
          label="Bookings"
          value={bookingsNow.toLocaleString()}
          icon={Briefcase}
          hint={`Created · ${periodPhrase}`}
          {...d(bookingsDelta)}
        />
        <StatCard
          label="Conversion"
          value={`${convNow}%`}
          icon={Percent}
          hint="Won ÷ closed deals"
          {...d(convDelta)}
        />
        {hasCostBasis ? (
          <StatCard
            label="Avg margin"
            value={`${(Math.round(marginNow * 10) / 10).toLocaleString()}%`}
            icon={TrendingUp}
            hint="Profit ÷ proposal value"
            {...d(marginDelta)}
          />
        ) : null}
        <StatCard
          label="Repeat rate"
          value={repeatNow === null ? "—" : `${repeatNow}%`}
          icon={Repeat}
          hint="Clients with ≥2 bookings"
          {...d(repeatDelta)}
        />
      </div>

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
          <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-[#162244] to-[#0E1525] p-6 text-white shadow-[var(--shadow-card)]">
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
                Next month forecast
              </span>
              <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">
                {formatMoneyCompact(weightedForecast)}
              </p>
              <p className="mt-2 max-w-[92%] text-sm leading-relaxed text-blue-100/80">
                Weighted on open-pipeline probability — Σ deal value × win likelihood.
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
              dotClass="bg-[var(--chart-1)]"
              label="Open opportunities"
              value={formatMoney(openPipeline)}
            />
            <GlanceRow
              dotClass="bg-[var(--chart-2)]"
              label="Avg booking value"
              value={formatMoney(avgBookingValue)}
            />
            <GlanceRow
              dotClass="bg-amber-500"
              label="Outstanding balance"
              value={formatMoney(outstanding)}
            />
            <GlanceRow
              dotClass="bg-[var(--chart-4)]"
              label="Proposals accepted"
              value={`${winRate}%`}
            />
          </SectionCard>
        </div>
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
  dotClass,
  label,
  value,
}: {
  dotClass: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className={`size-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
      <span className="text-muted-foreground flex-1 truncate text-sm">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/** Mirrors the analytics layout while the queries resolve. */
export function ReportsAnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card-elevated h-[104px] animate-pulse rounded-lg border bg-card" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card-elevated h-80 animate-pulse rounded-lg border bg-card lg:col-span-2" />
        <div className="card-elevated h-80 animate-pulse rounded-lg border bg-card" />
      </div>
    </div>
  );
}
