import { eq } from "drizzle-orm";
import {
  BarChart3,
  Users,
  Tag,
  Globe,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { StatStrip, StatStripSkeleton } from "@/components/app/stat-strip";
import {
  BarInsight,
  DonutInsight,
  HBarInsight,
} from "@/components/charts/insight-charts";
import { SectionCard } from "@/components/dashboard/section-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  growthPct,
  countBy,
  monthlyBuckets,
  num,
  topN,
} from "@/lib/analytics";
import { db } from "@/lib/db";
import {
  DEFAULT_CURRENCY,
  LEAD_SOURCE_LABEL,
  type LeadSource,
} from "@/lib/domain";
import { formatMoneyCompact } from "@/lib/format";
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

  // Revenue per agent (was: booking count). Map createdById → first name.
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

  // Revenue growth basis — last 2 months by createdAt, DZD, for the MoM KPI.
  const revenueMonthly = monthlyBuckets(dzdActive, (b) => b.createdAt, (b) => num(b.totalAmount), 2);

  // Top clients by revenue.
  const topClients = topN(dzdActive, (b) => b.client?.name, (b) => num(b.totalAmount), 8);

  // Lead-source breakdown (by client count). Uses free-text source today;
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
  for (const b of bookings) {
    const total = num(b.totalAmount);
    const { paid } = paymentSummary(b.payments, total);
    collected += paid;
  }

  // Won pipeline (all opportunities, agency-scoped).
  const allOpps = await db
    .select({ value: opportunity.value, stage: opportunity.stage })
    .from(opportunity)
    .where(eq(opportunity.agencyId, agencyId));
  const wonOpps = allOpps.filter((o) => o.stage === "won");
  const wonPipeline = wonOpps.reduce((s, o) => s + num(o.value), 0);

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

      {/* Finance KPIs — the analytics unique to the manager insights band
          (the main dashboard already surfaces conversion, outstanding &
          avg-booking-value). */}
      <StatStrip
        items={[
          {
            label: "Total revenue",
            value: formatMoneyCompact(totalRevenue, DEFAULT_CURRENCY),
          },
          {
            label: "Collected",
            value: formatMoneyCompact(collected, DEFAULT_CURRENCY),
            tone: "text-success",
          },
          {
            label: "Won pipeline",
            value: formatMoneyCompact(wonPipeline, DEFAULT_CURRENCY),
            tone: "text-success",
          },
          {
            label: "Revenue growth",
            value:
              revenueGrowth === null
                ? "—"
                : `${revenueGrowth > 0 ? "+" : ""}${revenueGrowth}%`,
          },
        ]}
      />

      {/* Charts — only shown when there is data to display. The revenue-trend,
          bookings-by-status and top-destinations panels live on the main
          dashboard; this band keeps the analytics unique to managers. */}
      {bookings.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SectionCard icon={BarChart3} title="Revenue per agent" subtitle="By revenue · DZD">
            <BarInsight data={revenueByAgent} format="currency" color="var(--chart-2)" />
          </SectionCard>

          <SectionCard icon={Users} title="Top clients" subtitle="By revenue · DZD">
            <HBarInsight data={topClients} format="currency" color="var(--chart-3)" />
          </SectionCard>

          <SectionCard icon={Tag} title="Lead sources" subtitle="By client count">
            <DonutInsight data={leadSources} />
          </SectionCard>

          <SectionCard icon={Globe} title="Top source markets" subtitle="Clients by country">
            <HBarInsight data={sourceMarkets} color="var(--chart-5)" />
          </SectionCard>
        </div>
      )}
    </section>
  );
}

// Skeleton shown while the insights queries resolve. Mirrors the single KPI
// strip + 2-col chart grid above so the layout doesn't jump when it streams in.
export function DashboardInsightsSkeleton() {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="text-muted-foreground size-5" />
        <Skeleton className="h-7 w-32" />
      </div>
      <StatStripSkeleton cells={4} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="card-elevated overflow-hidden">
            <div className="border-b px-5 py-4">
              <Skeleton className="h-5 w-40" />
            </div>
            <CardContent className="p-5">
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
