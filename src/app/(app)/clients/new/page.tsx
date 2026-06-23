import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ClientForm } from "@/components/clients/client-form";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/permissions";
import { listTeamMembers } from "@/lib/queries";

export const metadata = { title: "New client" };

export default async function NewClientPage() {
  const user = await requireUser();
  const team = await listTeamMembers();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/clients">
          <ArrowLeft className="mr-1 size-4" />
          Clients
        </Link>
      </Button>
      <PageHeader title="New client" description="Add a client account to your book." />
      <ClientForm
        mode="create"
        teamMembers={team}
        initial={{ ownerId: user.id, status: "active", type: "individual" }}
      />
    </div>
  );
}
