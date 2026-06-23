import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ProductForm } from "@/components/products/product-form";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { toDateInputValue } from "@/lib/format";
import { requireUser } from "@/lib/permissions";
import { listClientOptions, listOpportunityOptions } from "@/lib/queries";
import { product } from "@/lib/schema";

export const metadata = { title: "Edit proposal" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const [p, clients, opportunities] = await Promise.all([
    db.query.product.findFirst({ where: eq(product.id, id) }),
    listClientOptions(),
    listOpportunityOptions(),
  ]);
  if (!p) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/products/${id}`}>
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
          validUntil: toDateInputValue(p.validUntil),
          summary: p.summary ?? "",
        }}
      />
    </div>
  );
}
