import type { ProposalDocData } from "@/components/products/proposal-document";

/** Shape of a product row (with items) as queried for the proposal document. */
type ProductWithItems = {
  reference: string;
  title: string;
  destination: string | null;
  startDate: Date | null;
  endDate: Date | null;
  paxCount: number;
  currency: string;
  totalPrice: string;
  summary: string | null;
  validUntil: Date | null;
  createdAt: Date | null;
  client?: { name: string | null } | null;
  items: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    supplier: string | null;
    quantity: number;
    unitPrice: string;
    currency: string;
    startDate: Date | null;
    endDate: Date | null;
  }>;
};

/**
 * Normalizes a queried product row into the shared `ProposalDocData` shape used
 * by the `ProposalDocument` renderer. Keeps every surface (builder preview,
 * public link, internal preview, portal) in sync from a single mapping.
 */
export function toProposalDocData(
  p: ProductWithItems,
  clientName?: string | null
): ProposalDocData {
  return {
    reference: p.reference,
    title: p.title,
    clientName: clientName ?? p.client?.name ?? null,
    destination: p.destination,
    startDate: p.startDate,
    endDate: p.endDate,
    paxCount: p.paxCount,
    currency: p.currency,
    totalPrice: p.totalPrice,
    summary: p.summary,
    validUntil: p.validUntil,
    createdAt: p.createdAt,
    items: p.items.map((i) => ({
      id: i.id,
      type: i.type,
      title: i.title,
      description: i.description,
      supplier: i.supplier,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      currency: i.currency,
      startDate: i.startDate,
      endDate: i.endDate,
    })),
  };
}
