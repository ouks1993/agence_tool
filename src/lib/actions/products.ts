"use server";

import { revalidatePath } from "next/cache";
import { and, eq, max, sql } from "drizzle-orm";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { canDeleteRecords } from "@/lib/domain";
import { requireAgencyUser } from "@/lib/permissions";
import { client, opportunity, product, productItem } from "@/lib/schema";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** True when a DB error is a Postgres unique-constraint violation (code 23505). */
function isUniqueViolation(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  const causeCode = (e as { cause?: { code?: string } })?.cause?.code;
  return code === "23505" || causeCode === "23505";
}

/**
 * Next per-agency product reference. Derived from the highest existing reference
 * number (NOT the row count) so deleting a product can never produce a colliding
 * reference. Callers retry on the rare concurrent-insert collision.
 */
async function nextReference(agencyId: string): Promise<string> {
  // Aggregate the highest numeric suffix in SQL instead of fetching every row.
  // `regexp_replace(reference, '\D', '', 'g')` mirrors the previous JS
  // `replace(/\D/g, "")`; rows whose digits don't parse to an int yield NULL and
  // are ignored by max(). Floor stays 1000 so the first reference is PRD-1001.
  const [row] = await db
    .select({
      maxRef: max(
        sql<number>`nullif(regexp_replace(${product.reference}, '\\D', '', 'g'), '')::int`
      ),
    })
    .from(product)
    .where(eq(product.agencyId, agencyId));
  // max() over a numeric column comes back as a string (or null when no rows);
  // parse it back, falling through to the 1000 floor on null/NaN.
  const parsed = Number.parseInt(String(row?.maxRef ?? ""), 10);
  const highest = Math.max(1000, Number.isFinite(parsed) ? parsed : 1000);
  return `PRD-${highest + 1}`;
}

/** Recompute per-item client prices and product totals from item costs + markup. */
async function recalcTotals(productId: string): Promise<void> {
  const p = await db.query.product.findFirst({
    where: eq(product.id, productId),
    with: { items: true },
  });
  if (!p) return;
  const markup = parseFloat(p.markupPercent || "0");
  let totalCost = 0;
  // Collect the per-item price corrections, then issue them in parallel instead
  // of awaiting one UPDATE per item sequentially (N+1). Only items whose price
  // actually changed are updated, exactly as before.
  const itemUpdates: Promise<unknown>[] = [];
  for (const item of p.items) {
    const cost = parseFloat(item.unitCost || "0") * item.quantity;
    totalCost += cost;
    const unitPrice = round2(parseFloat(item.unitCost || "0") * (1 + markup / 100));
    if (unitPrice !== parseFloat(item.unitPrice || "0")) {
      itemUpdates.push(
        db
          .update(productItem)
          .set({ unitPrice: String(unitPrice) })
          .where(eq(productItem.id, item.id))
      );
    }
  }
  await Promise.all(itemUpdates);
  const totalPrice = round2(totalCost * (1 + markup / 100));
  await db
    .update(product)
    .set({ totalCost: String(round2(totalCost)), totalPrice: String(totalPrice) })
    .where(eq(product.id, productId));
}

// --- Product CRUD -----------------------------------------------------------

const productInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  clientId: z.string().optional(),
  opportunityId: z.string().optional(),
  destination: z.string().trim().max(200).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  paxCount: z.coerce.number().int().min(1).default(1),
  currency: z.string().trim().min(1).max(8).default("DZD"),
  markupPercent: z.coerce.number().min(0).max(100).default(0),
  summary: z.string().trim().max(20000).optional(),
  validUntil: z.string().optional(),
});

export type ProductInput = z.input<typeof productInput>;

export async function createProduct(
  input: ProductInput
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAgencyUser();
  const parsed = productInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;

  // Cross-table references must belong to the caller's agency.
  if (d.clientId) {
    const ok = await db.query.client.findFirst({
      where: and(eq(client.id, d.clientId), eq(client.agencyId, user.agencyId)),
      columns: { id: true },
    });
    if (!ok) return { ok: false, error: "Not found" };
  }
  if (d.opportunityId) {
    const ok = await db.query.opportunity.findFirst({
      where: and(
        eq(opportunity.id, d.opportunityId),
        eq(opportunity.agencyId, user.agencyId)
      ),
      columns: { id: true },
    });
    if (!ok) return { ok: false, error: "Not found" };
  }

  // Generate a reference and insert, retrying on the rare reference collision
  // (two proposals created at the same instant resolving the same max+1).
  let reference = "";
  let row: { id: string } | undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    reference = await nextReference(user.agencyId);
    try {
      [row] = await db
        .insert(product)
        .values({
          agencyId: user.agencyId,
          reference,
          title: d.title,
          clientId: d.clientId || null,
          opportunityId: d.opportunityId || null,
          destination: d.destination || null,
          startDate: toDate(d.startDate),
          endDate: toDate(d.endDate),
          paxCount: d.paxCount,
          currency: d.currency,
          markupPercent: String(d.markupPercent),
          summary: d.summary || null,
          validUntil: toDate(d.validUntil),
          createdById: user.id,
        })
        .returning({ id: product.id });
      break;
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 4) continue;
      throw e;
    }
  }

  if (!row) return { ok: false, error: "Failed to create proposal" };

  await logActivity({
    agencyId: user.agencyId,
    userId: user.id,
    action: "created",
    entityType: "product",
    entityId: row.id,
    entityLabel: `${reference} · ${d.title}`,
  });

  revalidatePath("/products"); revalidatePath("/proposals");
  return { ok: true, data: { id: row.id } };
}

export async function updateProduct(
  id: string,
  input: ProductInput
): Promise<ActionResult> {
  const user = await requireAgencyUser();
  const parsed = productInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;
  const existing = await db.query.product.findFirst({
    where: and(eq(product.id, id), eq(product.agencyId, user.agencyId)),
  });
  if (!existing) return { ok: false, error: "Proposal not found" };

  // Cross-table references must belong to the caller's agency.
  if (d.clientId) {
    const ok = await db.query.client.findFirst({
      where: and(eq(client.id, d.clientId), eq(client.agencyId, user.agencyId)),
      columns: { id: true },
    });
    if (!ok) return { ok: false, error: "Not found" };
  }
  if (d.opportunityId) {
    const ok = await db.query.opportunity.findFirst({
      where: and(
        eq(opportunity.id, d.opportunityId),
        eq(opportunity.agencyId, user.agencyId)
      ),
      columns: { id: true },
    });
    if (!ok) return { ok: false, error: "Not found" };
  }

  await db
    .update(product)
    .set({
      title: d.title,
      clientId: d.clientId || null,
      opportunityId: d.opportunityId || null,
      destination: d.destination || null,
      startDate: toDate(d.startDate),
      endDate: toDate(d.endDate),
      paxCount: d.paxCount,
      currency: d.currency,
      markupPercent: String(d.markupPercent),
      summary: d.summary || null,
      validUntil: toDate(d.validUntil),
    })
    .where(and(eq(product.id, id), eq(product.agencyId, user.agencyId)));

  await recalcTotals(id);

  await logActivity({
    agencyId: user.agencyId,
    userId: user.id,
    action: "updated",
    entityType: "product",
    entityId: id,
    entityLabel: `${existing.reference} · ${d.title}`,
  });

  revalidatePath("/products"); revalidatePath("/proposals");
  revalidatePath(`/proposals/${id}`);
  return { ok: true };
}

export async function setProductStatus(
  id: string,
  status: "draft" | "sent" | "accepted" | "rejected" | "expired"
): Promise<ActionResult> {
  const user = await requireAgencyUser();
  const existing = await db.query.product.findFirst({
    where: and(eq(product.id, id), eq(product.agencyId, user.agencyId)),
  });
  if (!existing) return { ok: false, error: "Proposal not found" };

  await db
    .update(product)
    .set({ status })
    .where(and(eq(product.id, id), eq(product.agencyId, user.agencyId)));

  await logActivity({
    agencyId: user.agencyId,
    userId: user.id,
    action: status === "sent" ? "sent" : "status_changed",
    entityType: "product",
    entityId: id,
    entityLabel: `${existing.reference} · ${existing.title}`,
    metadata: { to: status },
  });

  revalidatePath("/products"); revalidatePath("/proposals");
  revalidatePath(`/proposals/${id}`);
  return { ok: true };
}

/**
 * Creates (or rotates) the public, signable proposal link. Moves a draft to
 * "sent" since sharing it is effectively sending it to the client.
 */
export async function generateProposalLink(
  id: string
): Promise<ActionResult<{ token: string }>> {
  const user = await requireAgencyUser();
  const existing = await db.query.product.findFirst({
    where: and(eq(product.id, id), eq(product.agencyId, user.agencyId)),
    columns: { id: true, status: true, reference: true, title: true },
  });
  if (!existing) return { ok: false, error: "Proposal not found" };

  const token = crypto.randomUUID().replace(/-/g, "");
  await db
    .update(product)
    .set({ shareToken: token, status: existing.status === "draft" ? "sent" : existing.status })
    .where(and(eq(product.id, id), eq(product.agencyId, user.agencyId)));

  await logActivity({
    agencyId: user.agencyId,
    userId: user.id,
    action: "sent",
    entityType: "product",
    entityId: id,
    entityLabel: `${existing.reference} · ${existing.title}`,
    metadata: { sharedLink: true },
  });

  revalidatePath("/products"); revalidatePath("/proposals");
  revalidatePath(`/proposals/${id}`);
  return { ok: true, data: { token } };
}

/** Disables the public proposal link (revokes the share token). */
export async function revokeProposalLink(id: string): Promise<ActionResult> {
  const user = await requireAgencyUser();
  await db
    .update(product)
    .set({ shareToken: null })
    .where(and(eq(product.id, id), eq(product.agencyId, user.agencyId)));
  revalidatePath(`/proposals/${id}`);
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const user = await requireAgencyUser();
  const existing = await db.query.product.findFirst({
    where: and(eq(product.id, id), eq(product.agencyId, user.agencyId)),
  });
  if (!existing) return { ok: false, error: "Proposal not found" };
  if (!canDeleteRecords(user.role) && existing.createdById !== user.id) {
    return { ok: false, error: "You don't have permission to delete this" };
  }

  await db
    .delete(product)
    .where(and(eq(product.id, id), eq(product.agencyId, user.agencyId)));

  await logActivity({
    agencyId: user.agencyId,
    userId: user.id,
    action: "deleted",
    entityType: "product",
    entityId: id,
    entityLabel: `${existing.reference} · ${existing.title}`,
  });

  revalidatePath("/products"); revalidatePath("/proposals");
  return { ok: true };
}

// --- Items ------------------------------------------------------------------

const itemInput = z.object({
  type: z.enum(["flight", "hotel", "activity", "transfer", "insurance", "other"]),
  title: z.string().trim().min(1, "Title is required").max(300),
  description: z.string().trim().max(2000).optional(),
  supplier: z.string().trim().max(120).optional(),
  supplierId: z.string().uuid().optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  unitCost: z.coerce.number().min(0).default(0),
  currency: z.string().trim().min(1).max(8).default("DZD"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  details: z.unknown().optional(),
});

export type ItemInput = z.input<typeof itemInput>;

export async function addProductItem(
  productId: string,
  input: ItemInput
): Promise<ActionResult> {
  const user = await requireAgencyUser();
  const parsed = itemInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid item" };
  }
  // The child item has no agencyId, so verify the parent product's tenant first.
  const parent = await db.query.product.findFirst({
    where: and(eq(product.id, productId), eq(product.agencyId, user.agencyId)),
    columns: { id: true },
  });
  if (!parent) return { ok: false, error: "Not found" };
  const d = parsed.data;
  const count = await db.$count(productItem, eq(productItem.productId, productId));

  await db.insert(productItem).values({
    productId,
    type: d.type,
    title: d.title,
    description: d.description || null,
    supplierId: d.supplierId ?? null,
    supplier: d.supplier || null,
    quantity: d.quantity,
    unitCost: String(d.unitCost),
    unitPrice: String(d.unitCost),
    currency: d.currency,
    startDate: toDate(d.startDate),
    endDate: toDate(d.endDate),
    details: (d.details as object) ?? null,
    sortOrder: count,
  });

  await recalcTotals(productId);
  revalidatePath(`/proposals/${productId}`);
  return { ok: true };
}

export async function removeProductItem(
  itemId: string,
  // The product id is derived from the loaded item for safety; the caller still
  // passes it positionally but it is intentionally not trusted here.
  _productId: string
): Promise<ActionResult> {
  const user = await requireAgencyUser();
  // Load the item, then confirm its parent product belongs to the caller's agency
  // before deleting — the item row carries no agencyId of its own.
  const item = await db.query.productItem.findFirst({
    where: eq(productItem.id, itemId),
    columns: { id: true, productId: true },
    with: { product: { columns: { id: true, agencyId: true } } },
  });
  if (!item || item.product.agencyId !== user.agencyId) {
    return { ok: false, error: "Not found" };
  }
  await db.delete(productItem).where(eq(productItem.id, itemId));
  await recalcTotals(item.productId);
  revalidatePath(`/proposals/${item.productId}`);
  return { ok: true };
}

/**
 * Adds an item to an existing proposal, or creates a new draft proposal first.
 * Used by the search results "Add to proposal" flow.
 */
export async function addItemToProposal(input: {
  productId?: string | undefined;
  newProductTitle?: string | undefined;
  clientId?: string | undefined;
  item: ItemInput;
}): Promise<ActionResult<{ productId: string }>> {
  const user = await requireAgencyUser();
  let productId = input.productId;

  if (!productId) {
    const created = await createProduct({
      title: input.newProductTitle || input.item.title,
      clientId: input.clientId,
      currency: input.item.currency,
    });
    if (!created.ok || !created.data) {
      return { ok: false, error: created.ok ? "Failed to create proposal" : created.error };
    }
    productId = created.data.id;
  }

  // addProductItem validates that the parent product belongs to the agency, so
  // a productId from another tenant is rejected here before anything is logged.
  const res = await addProductItem(productId, input.item);
  if (!res.ok) return res;

  await logActivity({
    agencyId: user.agencyId,
    userId: user.id,
    action: "updated",
    entityType: "product",
    entityId: productId,
    entityLabel: input.item.title,
    metadata: { itemAdded: input.item.type },
  });

  revalidatePath(`/proposals/${productId}`);
  return { ok: true, data: { productId } };
}
