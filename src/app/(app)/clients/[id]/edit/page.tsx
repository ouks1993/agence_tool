import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ClientForm } from "@/components/clients/client-form";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/permissions";
import { listTeamMembers } from "@/lib/queries";
import { client } from "@/lib/schema";

export const metadata = { title: "Edit client" };

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const team = await listTeamMembers();
  const c = await db.query.client.findFirst({ where: eq(client.id, id) });
  if (!c) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/clients/${id}`}>
          <ArrowLeft className="mr-1 size-4" />
          {c.name}
        </Link>
      </Button>
      <PageHeader title="Edit client" />
      <ClientForm
        mode="edit"
        clientId={id}
        teamMembers={team}
        initial={{
          name: c.name,
          type: c.type as "individual" | "corporate",
          status: c.status as "lead" | "active" | "inactive",
          email: c.email ?? "",
          phone: c.phone ?? "",
          company: c.company ?? "",
          address: c.address ?? "",
          city: c.city ?? "",
          country: c.country ?? "",
          source: c.source ?? "",
          notes: c.notes ?? "",
          ownerId: c.ownerId ?? "",
        }}
      />
    </div>
  );
}
