import {
  BarChart3,
  Briefcase,
  Wallet,
  Banknote,
  Coins,
  Trophy,
  Percent,
  TrendingUp,
  Gauge,
  Users,
  Tag,
  MapPin,
  Globe,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { StatCard } from "@/components/app/stat-card";
import {
  BarInsight,
  DonutInsight,
  AreaInsight,
  HBarInsight,
} from "@/components/charts/insight-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/db";
import {
  BOOKING_STATUS_META,
  LEAD_SOURCE_LABEL,
  type BookingStatus,
  type LeadSource,
} from "@/lib/domain";
import {
  conversionRate,
  countBy,
  growthPct,
  monthlyBuckets,
  num,
  topN,
} from "@/lib/analytics";
import { formatMoney } from "@/lib/format";
import { paymentSummary } from "@/lib/payments/summary";
import { opportunity, client as clientTable, user as userTable } from "@/lib/schema";

/**
 * Minimal shape of the bookings the insights section reads. The dashboard page
 * already loads these rows for its KPI/upcoming sections, so we pass them in as
 * props rather than re-querying — only the insights-specific queries (members,
 * client sources, opportunities) run here, behind the Suspense boundary.
 */
export type InsightBooking = {
  status: string;
  currency: string | null;
  destination: string | null;
  totalAmount: string | null;
  createdById: string | null;
  createdAt: Date;
  client: { name: string } | null;
  payments: { amount: string; kind: string; status: string }[];
};

export async function DashboardInsights({
  agencyId,
  bookings,
  active,
}: {
  agencyId: string;
  bookings: InsightBooking[];
  active: InsightBooking[];
}) {
  const t = await getTranslations("dashboard");

  // Revenue basis for monetary charts: non-cancelled bookings in DZD (the
  // agency currency). No FX, so any non-DZD booking is excluded from money
  // charts rather than mis-summed.
  const dzdActive = active.filter((b) => (b.currency || "DZD") === "DZD");
  // "Country" label from "Marrakech, Morocco" → "Morocco" (heuristic until
  // destinations are structured in Phase 3).
  const countryOf = (raw: string | null | undefined) =>
    raw
      ? raw.includes(",")
        ? raw.slice(raw.lastIndexOf(",") + 1).trim() || raw
        : raw
      : "Unknown";

  // 1) Top destinations by REVENUE (was: count).
  const byDestination = topN(dzdActive, (b) => countryOf(b.destination), (b) => num(b.totalAmount), 8);

  // 2) Bookings by status — count donut (currency-agnostic).
  const byStatus = countBy(bookings, (b) => BOOKING_STATUS_META[b.status as BookingStatus]?.label ?? b.status, 8);

  // 3) Revenue per agent (was: booking count). Map createdById → first name.
  const members = await db
    .select({ id: userTable.id, name: userTable.name })
    .from(userTable)
    .where(eq(userTable.agencyId, agencyId));
  const memberName = new Map(members.map((m) => [m.id, m.name.split(" ")[0] || m.name]));
  const revenueByAgent = topN(
    dzdActive,
    (b) => (b.createdById ? memberName.get(b.createdById) ?? "Unknown" : "Unassigned"),
    (b) => num(b.totalAmount),
    8
  );

  // 4) Revenue evolution — last 6 months by createdAt, DZD (was: count).
  const revenueMonthly = monthlyBuckets(dzdActive, (b) => b.createdAt, (b) => num(b.totalAmount), 6);

  // 5) Top clients by revenue.
  const topClients = topN(dzdActive, (b) => b.client?.name, (b) => num(b.totalAmount), 8);

  // 6) Lead-source breakdown (by client count). Uses free-text source today;
  // becomes clean once Phase 2 makes it an enum.
  const sourceRows = await db
    .select({ source: clientTable.source, country: clientTable.country })
    .from(clientTable)
    .where(eq(clientTable.agencyId, agencyId));
  const leadSources = countBy(
    sourceRows,
    (r) => (r.source ? LEAD_SOURCE_LABEL[r.source as LeadSource] ?? r.source : "Unknown"),
    6
  );
  // Top source markets — clients grouped by country (clean now that country
  // is picked from the ISO list).
  const sourceMarkets = countBy(sourceRows, (r) => r.country, 8);

  // Finance KPIs.
  const totalRevenue = dzdActive
    .filter((b) => b.status === "confirmed")
    .reduce((s, b) => s + num(b.totalAmount), 0);

  let collected = 0;
  let outstanding = 0;
  for (const b of bookings) {
    const total = num(b.totalAmount);
    const { paid, balance } = paymentSummary(b.payments, total);
    collected += paid;
    if (balance > 0) outstanding += balance;
  }

  // Won pipeline + conversion rate (all opportunities, agency-scoped).
  const allOpps = await db
    .select({ value: opportunity.value, stage: opportunity.stage })
    .from(opportunity)
    .where(eq(opportunity.agencyId, agencyId));
  const wonOpps = allOpps.filter((o) => o.stage === "won");
  const wonPipeline = wonOpps.reduce((s, o) => s + num(o.value), 0);
  // Conversion = won ÷ closed (won + lost) deals.
  const closedOpps = allOpps.filter((o) => o.stage === "won" || o.stage === "lost").length;
  const convRate = conversionRate(wonOpps.length, closedOpps);

  // Average booking value (non-cancelled, DZD).
  const avgBookingValue = dzdActive.length
    ? Math.round(dzdActive.reduce((s, b) => s + num(b.totalAmount), 0) / dzdActive.length)
    : 0;

  // MoM revenue growth from the last two month buckets.
  const lastTwo = revenueMonthly.slice(-2);
  const revenueGrowth =
    lastTwo.length === 2 ? growthPct(lastTwo[1]!.value, lastTwo[0]!.value) : null;

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="text-muted-foreground size-5" />
        <h2 className="text-xl font-semibold tracking-tight">{t("insights")}</h2>
      </div>

      {/* Finance KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={formatMoney(totalRevenue)}
          hint="Confirmed bookings"
          icon={Wallet}
        />
        <StatCard
          label="Collected"
          value={formatMoney(collected)}
          hint="Completed payments, net of refunds"
          icon={Banknote}
        />
        <StatCard
          label="Outstanding"
          value={formatMoney(outstanding)}
          hint="Balances still due"
          icon={Coins}
        />
        <StatCard
          label="Won pipeline"
          value={formatMoney(wonPipeline)}
          hint="Opportunities marked won"
          icon={Trophy}
        />
      </div>

      {/* Performance KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Conversion rate"
          value={`${convRate}%`}
          hint="Won ÷ closed deals"
          icon={Percent}
        />
        <StatCard
          label="Avg booking value"
          value={formatMoney(avgBookingValue)}
          hint="Across active bookings"
          icon={Gauge}
        />
        <StatCard
          label="Revenue growth"
          value={
            revenueGrowth === null
              ? "—"
              : `${revenueGrowth > 0 ? "+" : ""}${revenueGrowth}%`
          }
          hint="Month over month"
          icon={TrendingUp}
        />
      </div>

      {/* Charts — only shown when there is data to display */}
      {bookings.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="size-4" /> Revenue evolution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AreaInsight data={revenueMonthly} format="currency" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="size-4" /> Top destinations by revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <HBarInsight data={byDestination} format="currency" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" /> Top clients by revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <HBarInsight data={topClients} format="currency" color="var(--chart-3)" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="size-4" /> Revenue per agent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BarInsight data={revenueByAgent} format="currency" color="var(--chart-2)" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="size-4" /> Bookings by status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DonutInsight data={byStatus} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Tag className="size-4" /> Lead sources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DonutInsight data={leadSources} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="size-4" /> Top source markets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <HBarInsight data={sourceMarkets} color="var(--chart-5)" />
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}

// Skeleton shown while the insights queries resolve. Mirrors the KPI grids +
// 2-col chart grid above so the layout doesn't jump when it streams in.
export function DashboardInsightsSkeleton() {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="text-muted-foreground size-5" />
        <Skeleton className="h-7 w-32" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="space-y-2 p-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
