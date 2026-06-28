import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { Plus, Target, Wallet, Gauge, Percent, TrendingUp, Filter } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { FunnelInsight } from "@/components/charts/insight-charts";
import { PipelineBoard, type BoardItem } from "@/components/opportunities/pipeline-board";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import {
  OPEN_STAGES,
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_META,
  seesAllData,
  type OpportunityStage,
} from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { conversionRate, num } from "@/lib/analytics";
import { requireAgencyUser } from "@/lib/permissions";
import { opportunity } from "@/lib/schema";

export const metadata = { title: "Opportunities" };

export default async function OpportunitiesPage() {
  const user = await requireAgencyUser();

  const rows = await db.query.opportunity.findMany({
    // Agents see only opportunities assigned to them (others see all).
    where: and(
      eq(opportunity.agencyId, user.agencyId),
      seesAllData(user.role) ? undefined : eq(opportunity.assignedToId, user.id)
    ),
    with: {
      client: { columns: { name: true } },
      assignedTo: { columns: { name: true } },
    },
    orderBy: [desc(opportunity.updatedAt)],
    limit: 500,
  });

  const items: BoardItem[] = rows.map((o) => ({
    id: o.id,
    title: o.title,
    clientName: o.client?.name ?? null,
    value: o.value,
    currency: o.currency,
    stage: o.stage,
    assigneeName: o.assignedTo?.name ?? null,
    destination: o.destination,
    travelStartDate: o.travelStartDate,
  }));

  // DZD-only for monetary pipeline metrics (no FX).
  const dzd = rows.filter((o) => (o.currency || "DZD") === "DZD");
  const isOpen = (s: string) => OPEN_STAGES.includes(s as (typeof OPEN_STAGES)[number]);

  const openValue = dzd.filter((o) => isOpen(o.stage)).reduce((sum, o) => sum + num(o.value), 0);
  const openCount = rows.filter((o) => isOpen(o.stage)).length;

  // Weighted forecast: Σ value × probability across OPEN deals.
  const forecast = dzd
    .filter((o) => isOpen(o.stage))
    .reduce((sum, o) => sum + num(o.value) * (o.probability / 100), 0);

  // Win rate: won ÷ closed (won + lost).
  const wonCount = rows.filter((o) => o.stage === "won").length;
  const closedCount = rows.filter((o) => o.stage === "won" || o.stage === "lost").length;
  const winRate = conversionRate(wonCount, closedCount);

  // Avg deal size: won deals' value (DZD).
  const wonDzd = dzd.filter((o) => o.stage === "won");
  const avgDeal = wonDzd.length
    ? Math.round(wonDzd.reduce((s, o) => s + num(o.value), 0) / wonDzd.length)
    : 0;

  // Funnel by VALUE across the ordered stages (DZD).
  const funnel = OPPORTUNITY_STAGES.filter((s) => s !== "lost").map((s) => ({
    label: OPPORTUNITY_STAGE_META[s as OpportunityStage].label,
    value: dzd.filter((o) => o.stage === s).reduce((sum, o) => sum + num(o.value), 0),
  }));

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Opportunities"
        description={
          rows.length
            ? `${openCount} open · ${formatMoney(openValue)} in the pipeline`
            : "Your deal pipeline."
        }
      >
        <Button asChild>
          <Link href="/opportunities/new">
            <Plus className="mr-2 size-4" />
            New opportunity
          </Link>
        </Button>
      </PageHeader>

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Open pipeline"
              value={formatMoney(openValue)}
              hint={`${openCount} open deal${openCount === 1 ? "" : "s"}`}
              icon={Wallet}
            />
            <StatCard
              label="Weighted forecast"
              value={formatMoney(forecast)}
              hint="Value × probability"
              icon={TrendingUp}
            />
            <StatCard
              label="Win rate"
              value={`${winRate}%`}
              hint="Won ÷ closed deals"
              icon={Percent}
            />
            <StatCard
              label="Avg deal size"
              value={formatMoney(avgDeal)}
              hint="Won opportunities"
              icon={Gauge}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="size-4" /> Conversion funnel (by value)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FunnelInsight data={funnel} format="currency" />
            </CardContent>
          </Card>
        </>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No opportunities yet"
          description="Create your first opportunity to start tracking deals through the pipeline."
          action={
            <Button asChild>
              <Link href="/opportunities/new">
                <Plus className="mr-2 size-4" />
                New opportunity
              </Link>
            </Button>
          }
        />
      ) : (
        <PipelineBoard items={items} />
      )}
    </div>
  );
}
