import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { OpportunityForm } from "@/components/opportunities/opportunity-form";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { toDateInputValue } from "@/lib/format";
import { requireUser } from "@/lib/permissions";
import { listClientOptions, listTeamMembers } from "@/lib/queries";
import { opportunity } from "@/lib/schema";

export const metadata = { title: "Edit opportunity" };

export default async function EditOpportunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const [o, clients, team] = await Promise.all([
    db.query.opportunity.findFirst({ where: eq(opportunity.id, id) }),
    listClientOptions(),
    listTeamMembers(),
  ]);
  if (!o) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/opportunities/${id}`}>
          <ArrowLeft className="mr-1 size-4" />
          {o.title}
        </Link>
      </Button>
      <PageHeader title="Edit opportunity" />
      <OpportunityForm
        mode="edit"
        opportunityId={id}
        clients={clients}
        teamMembers={team}
        initial={{
          title: o.title,
          clientId: o.clientId,
          stage: o.stage,
          value: o.value,
          currency: o.currency,
          probability: String(o.probability),
          destination: o.destination ?? "",
          travelStartDate: toDateInputValue(o.travelStartDate),
          travelEndDate: toDateInputValue(o.travelEndDate),
          paxCount: String(o.paxCount),
          expectedCloseDate: toDateInputValue(o.expectedCloseDate),
          lostReason: o.lostReason ?? "",
          notes: o.notes ?? "",
          assignedToId: o.assignedToId ?? "",
        }}
      />
    </div>
  );
}
