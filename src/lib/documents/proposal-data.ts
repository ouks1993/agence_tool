import type { ProposalPdfData } from "@/lib/documents/proposal-pdf";
import { PRODUCT_ITEM_TYPE_META, type ProductItemType } from "@/lib/domain";

/** The product+relations shape both PDF routes load (agency- or token-scoped). */
export type ProductForPdf = {
  reference: string;
  title: string;
  destination: string | null;
  startDate: Date | null;
  endDate: Date | null;
  paxCount: number;
  summary: string | null;
  currency: string;
  totalPrice: string;
  validUntil: Date | null;
  acceptedAt: Date | null;
  signerName: string | null;
  client: { name: string } | null;
  items: {
    id: string;
    type: string;
    title: string;
    description: string | null;
    unitPrice: string;
    quantity: number;
    currency: string;
  }[];
};

/** Normalizes a DB product row into the flat shape the PDF renderer expects. */
export function mapProductToPdf(p: ProductForPdf): ProposalPdfData {
  return {
    reference: p.reference,
    title: p.title,
    clientName: p.client?.name ?? null,
    destination: p.destination,
    startDate: p.startDate,
    endDate: p.endDate,
    paxCount: p.paxCount,
    summary: p.summary,
    currency: p.currency,
    totalPrice: parseFloat(p.totalPrice || "0"),
    validUntil: p.validUntil,
    acceptedAt: p.acceptedAt,
    signerName: p.signerName,
    items: p.items.map((item) => ({
      id: item.id,
      title: item.title,
      typeLabel:
        PRODUCT_ITEM_TYPE_META[item.type as ProductItemType]?.label ?? item.type,
      description: item.description,
      linePrice: parseFloat(item.unitPrice || "0") * item.quantity,
      currency: item.currency,
    })),
  };
}
