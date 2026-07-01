import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { OpportunityForm } from "@/components/opportunities/opportunity-form";
import { Button } from "@/components/ui/button";
import { DEFAULT_CURRENCY } from "@/lib/domain";
import { requireAgencyUser } from "@/lib/permissions";
import { listClientOptions, listTeamMembers } from "@/lib/queries";

export const metadata = { title: "New opportunity" };

export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; stage?: string }>;
}) {
  const user = await requireAgencyUser();
  const sp = await searchParams;
  const [clients, team] = await Promise.all([
    listClientOptions(user.agencyId),
    listTeamMembers(user.agencyId),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/opportunities">
          <ArrowLeft className="mr-1 size-4" />
          Opportunities
        </Link>
      </Button>
      <PageHeader title="New opportunity" description="Track a new deal in the pipeline." />
      <OpportunityForm
        mode="create"
        clients={clients}
        teamMembers={team}
        initial={{
          clientId: sp.clientId ?? "",
          assignedToId: user.id,
          stage: sp.stage ?? "lead",
          currency: DEFAULT_CURRENCY,
          paxCount: "1",
        }}
      />
    </div>
  );
}
