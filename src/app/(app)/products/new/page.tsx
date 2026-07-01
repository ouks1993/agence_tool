import { PageHeader } from "@/components/app/page-header";
import { NewProductWithAi } from "@/components/products/new-product-with-ai";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { requireAgencyUser } from "@/lib/permissions";
import { listClientOptions, listOpportunityOptions } from "@/lib/queries";

export const metadata = { title: "New proposal" };

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; opportunityId?: string }>;
}) {
  const user = await requireAgencyUser();
  const sp = await searchParams;
  const [clients, opportunities] = await Promise.all([
    listClientOptions(user.agencyId),
    listOpportunityOptions(user.agencyId),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/proposals">Proposals</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New proposal</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader title="New proposal" description="Start a travel package for a client." />
      <NewProductWithAi
        clients={clients}
        opportunities={opportunities}
        initial={{
          clientId: sp.clientId ?? "",
          opportunityId: sp.opportunityId ?? "",
          currency: "DZD",
          markupPercent: "10",
          paxCount: "1",
        }}
      />
    </div>
  );
}
