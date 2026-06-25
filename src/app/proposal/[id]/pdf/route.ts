import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mapProductToPdf } from "@/lib/documents/proposal-data";
import { renderProposalPdf } from "@/lib/documents/proposal-pdf";
import { requireAgencyUser } from "@/lib/permissions";
import { product } from "@/lib/schema";

// @react-pdf/renderer needs the Node runtime (no headless browser involved).
export const runtime = "nodejs";

/** Authenticated proposal PDF — agency-scoped to the signed-in agent. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const user = await requireAgencyUser();
  const { id } = await params;

  const p = await db.query.product.findFirst({
    where: and(eq(product.id, id), eq(product.agencyId, user.agencyId)),
    with: {
      client: { columns: { name: true } },
      items: { orderBy: (t) => [asc(t.sortOrder)] },
    },
  });
  if (!p) return new Response("Not found", { status: 404 });

  const pdf = await renderProposalPdf(mapProductToPdf(p));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="proposal-${p.reference}.pdf"`,
    },
  });
}
