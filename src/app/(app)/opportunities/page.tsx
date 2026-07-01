import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { Plus, Target, Filter } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatStrip } from "@/components/app/stat-strip";
import { FunnelInsight } from "@/components/charts/insight-charts";
import { PipelineBoard, type BoardItem, type OwnerOption } from "@/components/opportunities/pipeline-board";
import { PipelineExportButton } from "@/components/opportunities/pipeline-export-button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { conversionRate, headlineTotal, num, sumByCurrency } from "@/lib/analytics";
import { db } from "@/lib/db";
import {
  OPEN_STAGES,
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_META,
  seesAllData,
  type OpportunityStage,
} from "@/lib/domain";
import { formatMoney, formatMoneyCompact } from "@/lib/format";
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
      assignedTo: { columns: { id: true, name: true } },
      // Latest linked proposal drives the card's proposal-status chip.
      products: {
        columns: { status: true, createdAt: true },
        orderBy: (t, { desc: d }) => [d(t.createdAt)],
        limit: 1,
      },
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
    assigneeId: o.assignedTo?.id ?? null,
    assigneeName: o.assignedTo?.name ?? null,
    destination: o.destination,
    travelStartDate: o.travelStartDate,
    probability: o.probability,
    travelPurpose: o.travelPurpose,
    expectedCloseDate: o.expectedCloseDate,
    proposalStatus: o.products[0]?.status ?? null,
  }));

  // Distinct owner list for the filter bar (real assignees only, de-duplicated).
  const ownerMap = new Map<string, string>();
  for (const o of rows) {
    if (o.assignedTo?.id) ownerMap.set(o.assignedTo.id, o.assignedTo.name ?? "—");
  }
  const owners: OwnerOption[] = Array.from(ownerMap, ([id, name]) => ({ id, name })).sort(
    (a, b) => a.name.localeCompare(b.name)
  );

  // Monetary pipeline metrics are DZD-only (no FX). We aggregate every metric
  // through sumByCurrency + headlineTotal so a stray EUR/USD deal is bucketed
  // separately and can never be silently summed into the DZD headline figure.
  const isOpen = (s: string) => OPEN_STAGES.includes(s as (typeof OPEN_STAGES)[number]);
  const cur = (o: (typeof rows)[number]) => o.currency || "DZD";

  const openDeals = rows.filter((o) => isOpen(o.stage));
  const openValue = headlineTotal(sumByCurrency(openDeals, (o) => num(o.value), cur));
  const openCount = openDeals.length;

  // Weighted forecast: Σ value × probability across OPEN deals (DZD headline).
  const forecast = headlineTotal(
    sumByCurrency(openDeals, (o) => num(o.value) * (o.probability / 100), cur)
  );

  // Win rate: won ÷ closed (won + lost) — count-based, currency-agnostic.
  const wonCount = rows.filter((o) => o.stage === "won").length;
  const closedCount = rows.filter((o) => o.stage === "won" || o.stage === "lost").length;
  const winRate = conversionRate(wonCount, closedCount);

  // Avg deal size: mean of won deals' value (DZD headline).
  const wonDeals = rows.filter((o) => o.stage === "won");
  const wonDzdCount = wonDeals.filter((o) => cur(o) === "DZD").length;
  const wonValue = headlineTotal(sumByCurrency(wonDeals, (o) => num(o.value), cur));
  const avgDeal = wonDzdCount ? Math.round(wonValue / wonDzdCount) : 0;

  // Won this month: Σ value of won deals whose updatedAt is in the current month (DZD headline).
  const now = new Date();
  const wonThisMonth = headlineTotal(
    sumByCurrency(
      wonDeals.filter((o) => {
        const d = o.updatedAt instanceof Date ? o.updatedAt : new Date(o.updatedAt);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }),
      (o) => num(o.value),
      cur
    )
  );

  // Funnel by VALUE across the ordered open+won stages (DZD headline; no Lost lane).
  const funnel = OPPORTUNITY_STAGES.filter((s) => s !== "lost").map((s) => ({
    label: OPPORTUNITY_STAGE_META[s as OpportunityStage].label,
    value: headlineTotal(
      sumByCurrency(
        rows.filter((o) => o.stage === s),
        (o) => num(o.value),
        cur
      )
    ),
  }));

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6 px-4 py-8 sm:px-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard">Workspace</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Pipeline</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title="Sales pipeline"
        description={
          rows.length
            ? `${openCount} open · ${formatMoney(openValue)} in the pipeline`
            : "Your deal pipeline."
        }
      >
        {rows.length > 0 && <PipelineExportButton items={items} />}
        <Button asChild>
          <Link href="/opportunities/new">
            <Plus className="mr-2 size-4" />
            New opportunity
          </Link>
        </Button>
      </PageHeader>

      {rows.length > 0 && (
        <>
          <StatStrip
            items={[
              { label: "Open pipeline", value: formatMoneyCompact(openValue) },
              { label: "Weighted forecast", value: formatMoneyCompact(forecast) },
              {
                label: "Won this month",
                value: formatMoneyCompact(wonThisMonth),
                tone: "text-success",
              },
              { label: "Avg. win rate", value: `${winRate}%` },
              { label: "Avg. deal size", value: formatMoneyCompact(avgDeal) },
            ]}
          />

          <Card className="card-elevated">
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
        <PipelineBoard items={items} owners={owners} currentUserId={user.id} nowMs={now.getTime()} />
      )}
    </div>
  );
}
