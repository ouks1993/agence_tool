import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Plus, Target } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PipelineBoard, type BoardItem } from "@/components/opportunities/pipeline-board";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { OPEN_STAGES } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { requireAgencyUser } from "@/lib/permissions";
import { opportunity } from "@/lib/schema";

export const metadata = { title: "Opportunities" };

export default async function OpportunitiesPage() {
  const user = await requireAgencyUser();

  const rows = await db.query.opportunity.findMany({
    where: eq(opportunity.agencyId, user.agencyId),
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

  const openValue = rows
    .filter((o) => OPEN_STAGES.includes(o.stage as (typeof OPEN_STAGES)[number]))
    .reduce((sum, o) => sum + parseFloat(o.value || "0"), 0);
  const openCount = rows.filter((o) =>
    OPEN_STAGES.includes(o.stage as (typeof OPEN_STAGES)[number])
  ).length;

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
