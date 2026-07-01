import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { Download } from "lucide-react";
import { PrintButton } from "@/components/products/print-button";
import { ProposalDocument } from "@/components/products/proposal-document";
import { Button } from "@/components/ui/button";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { db } from "@/lib/db";
import { requireAgencyUser } from "@/lib/permissions";
import { toProposalDocData } from "@/lib/proposal-doc";
import { product } from "@/lib/schema";

export const metadata = { title: "Proposal" };

export default async function ProposalView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Auth-protected: only signed-in agents preview the client-facing proposal,
  // and only for proposals belonging to their own agency.
  const user = await requireAgencyUser();
  const { id } = await params;

  const p = await db.query.product.findFirst({
    where: and(eq(product.id, id), eq(product.agencyId, user.agencyId)),
    with: {
      client: { columns: { name: true, email: true } },
      items: { orderBy: (t) => [asc(t.sortOrder)] },
    },
  });
  if (!p) notFound();

  const doc = toProposalDocData(p, p.client?.name ?? null);

  return (
    <div className="bg-muted/30 min-h-screen py-8 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl px-4 print:max-w-none print:px-0">
        <div className="mb-4 flex justify-end gap-2 print:hidden">
          <Button asChild variant="outline" size="sm">
            <Link href={`/proposal/${id}/pdf`} target="_blank">
              <Download className="mr-1 size-4" /> Download PDF
            </Link>
          </Button>
          <PrintButton />
        </div>

        <ProposalDocument data={doc} appName={APP_NAME} appTagline={APP_TAGLINE} />
      </div>
    </div>
  );
}
