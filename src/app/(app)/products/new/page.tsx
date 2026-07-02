import { eq } from "drizzle-orm";
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
import { db } from "@/lib/db";
import { effectiveDepositPercent } from "@/lib/payments/deposit";
import { requireAgencyUser } from "@/lib/permissions";
import { listClientOptions, listOpportunityOptions } from "@/lib/queries";
import { agency } from "@/lib/schema";

export const metadata = { title: "New proposal" };

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; opportunityId?: string }>;
}) {
  const user = await requireAgencyUser();
  const sp = await searchParams;
  const [clients, opportunities, ag] = await Promise.all([
    listClientOptions(user.agencyId),
    listOpportunityOptions(user.agencyId),
    db.query.agency.findFirst({
      where: eq(agency.id, user.agencyId),
      columns: { depositPercent: true },
    }),
  ]);
  const agencyDepositPercent = effectiveDepositPercent(null, ag?.depositPercent);

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
        agencyDepositPercent={agencyDepositPercent}
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
