import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mapProductToPdf } from "@/lib/documents/proposal-data";
import { renderProposalPdf } from "@/lib/documents/proposal-pdf";
import { product } from "@/lib/schema";

// @react-pdf/renderer needs the Node runtime (no headless browser involved).
export const runtime = "nodejs";

/** Public proposal PDF — authorized by the unguessable share token. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
): Promise<Response> {
  const { token } = await params;

  const p = await db.query.product.findFirst({
    where: eq(product.shareToken, token),
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
