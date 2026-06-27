import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { SupplierForm } from "@/components/suppliers/supplier-form";
import { Button } from "@/components/ui/button";
import { requireAgencyUser } from "@/lib/permissions";

export const metadata = { title: "New supplier" };

export default async function NewSupplierPage() {
  await requireAgencyUser();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/suppliers">
          <ArrowLeft className="mr-1 size-4" />
          Suppliers
        </Link>
      </Button>
      <PageHeader
        title="New supplier"
        description="Add a supplier to your directory."
      />
      <SupplierForm mode="create" />
    </div>
  );
}
