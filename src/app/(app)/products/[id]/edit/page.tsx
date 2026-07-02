import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ProductForm } from "@/components/products/product-form";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { toDateInputValue } from "@/lib/format";
import { effectiveDepositPercent } from "@/lib/payments/deposit";
import { requireAgencyUser } from "@/lib/permissions";
import { listClientOptions, listOpportunityOptions } from "@/lib/queries";
import { agency, product } from "@/lib/schema";

export const metadata = { title: "Edit proposal" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAgencyUser();
  const { id } = await params;
  const [p, clients, opportunities, ag] = await Promise.all([
    db.query.product.findFirst({
      where: and(eq(product.id, id), eq(product.agencyId, user.agencyId)),
    }),
    listClientOptions(user.agencyId),
    listOpportunityOptions(user.agencyId),
    db.query.agency.findFirst({
      where: eq(agency.id, user.agencyId),
      columns: { depositPercent: true },
    }),
  ]);
  if (!p) notFound();
  const agencyDepositPercent = effectiveDepositPercent(null, ag?.depositPercent);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/proposals/${id}`}>
          <ArrowLeft className="mr-1 size-4" />
          {p.reference}
        </Link>
      </Button>
      <PageHeader title="Edit proposal" />
      <ProductForm
        mode="edit"
        productId={id}
        clients={clients}
        opportunities={opportunities}
        agencyDepositPercent={agencyDepositPercent}
        initial={{
          title: p.title,
          clientId: p.clientId ?? "",
          opportunityId: p.opportunityId ?? "",
          destination: p.destination ?? "",
          startDate: toDateInputValue(p.startDate),
          endDate: toDateInputValue(p.endDate),
          paxCount: String(p.paxCount),
          currency: p.currency,
          markupPercent: p.markupPercent,
          // Empty string = inherit; a stored override pre-fills the field.
          depositPercent: p.depositPercent ?? "",
          validUntil: toDateInputValue(p.validUntil),
          summary: p.summary ?? "",
        }}
      />
    </div>
  );
}
