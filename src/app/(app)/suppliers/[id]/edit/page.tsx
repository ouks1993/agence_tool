import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { SupplierForm } from "@/components/suppliers/supplier-form";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
  const t = await getTranslations("suppliers");
  const { id } = await params;

  const s = await getSupplierById(id);
  if (!s) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/suppliers">{t("title")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/suppliers/${id}`}>{s.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t("editSupplier")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader title={t("editSupplier")} />
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
