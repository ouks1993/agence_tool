import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { OpportunityForm } from "@/components/opportunities/opportunity-form";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/permissions";
import { listClientOptions, listTeamMembers } from "@/lib/queries";

export const metadata = { title: "New opportunity" };

export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const [clients, team] = await Promise.all([
    listClientOptions(),
    listTeamMembers(),
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
          stage: "lead",
          currency: "EUR",
          paxCount: "1",
        }}
      />
    </div>
  );
}
