import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ProductForm } from "@/components/products/product-form";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/permissions";
import { listClientOptions, listOpportunityOptions } from "@/lib/queries";

export const metadata = { title: "New proposal" };

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; opportunityId?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const [clients, opportunities] = await Promise.all([
    listClientOptions(),
    listOpportunityOptions(),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/products">
          <ArrowLeft className="mr-1 size-4" />
          Proposals
        </Link>
      </Button>
      <PageHeader title="New proposal" description="Start a travel package for a client." />
      <ProductForm
        mode="create"
        clients={clients}
        opportunities={opportunities}
        initial={{
          clientId: sp.clientId ?? "",
          opportunityId: sp.opportunityId ?? "",
          currency: "EUR",
          markupPercent: "10",
          paxCount: "1",
        }}
      />
    </div>
  );
}
