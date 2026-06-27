import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { SupplierForm } from "@/components/suppliers/supplier-form";
import { Button } from "@/components/ui/button";
import { getSupplierById } from "@/lib/actions/suppliers";
import type { SupplierStatus, SupplierType } from "@/lib/domain";
import { requireAgencyUser } from "@/lib/permissions";

export const metadata = { title: "Edit supplier" };

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAgencyUser();
  const { id } = await params;

  const s = await getSupplierById(id);
  if (!s) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/suppliers/${id}`}>
          <ArrowLeft className="mr-1 size-4" />
          {s.name}
        </Link>
      </Button>
      <PageHeader title="Edit supplier" />
      <SupplierForm
        mode="edit"
        supplierId={id}
        defaultValues={{
          name: s.name,
          type: s.type as SupplierType,
          status: s.status as SupplierStatus,
          email: s.email ?? "",
          phone: s.phone ?? "",
          website: s.website ?? "",
          contactName: s.contactName ?? "",
          address: s.address ?? "",
          city: s.city ?? "",
          country: s.country ?? "",
          notes: s.notes ?? "",
        }}
      />
    </div>
  );
}
