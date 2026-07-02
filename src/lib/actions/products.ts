"use server";

import { revalidatePath } from "next/cache";
import { and, eq, max, sql } from "drizzle-orm";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { canDeleteRecords } from "@/lib/domain";
import { requireAgencyUser } from "@/lib/permissions";
import { priceFromMargin, round2, toNumber } from "@/lib/pricing";
import { client, opportunity, product, productItem } from "@/lib/schema";

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

/**
 * Recompute product totals as plain sums of the *stored* per-item cost and price.
 *
 * Margin now lives in each item's `unitPrice` (set individually per row, via the
 * proposal-level apply-to-all action, or from the default margin when an item is
 * created). `markupPercent` is the proposal's *default* margin — a UI seed — and
 * is no longer multiplied into the totals here (doing so would double-count the
 * margin already baked into `unitPrice`). Totals are therefore:
 *   totalCost  = Σ unitCost  × quantity
 *   totalPrice = Σ unitPrice × quantity
 */
async function recalcTotals(productId: string): Promise<void> {
  const p = await db.query.product.findFirst({
    where: eq(product.id, productId),
    with: { items: true },
  });
  if (!p) return;
  let totalCost = 0;
  let totalPrice = 0;
  for (const item of p.items) {
    totalCost += toNumber(item.unitCost) * item.quantity;
    totalPrice += toNumber(item.unitPrice) * item.quantity;
  }
  await db
    .update(product)
    .set({
      totalCost: String(round2(totalCost)),
      totalPrice: String(round2(totalPrice)),
    })
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
  // Optional per-deal deposit override (% of the total that "secures the dates").
  // `null` means "inherit the agency default" — the effective % resolves along
  // the chain booking.depositPercent ?? product.depositPercent ?? agency.depositPercent.
  // `0` is a meaningful value (no deposit), distinct from null, so the form maps
  // an empty field to null (not 0).
  depositPercent: z.coerce.number().min(0).max(100).nullable().optional(),
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
          // Empty field → null (inherit); an explicit 0..100 override is stored
          // as a numeric string. `?? null` keeps `undefined` out of the DB write.
          depositPercent:
            d.depositPercent == null ? null : String(d.depositPercent),
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
      // Empty field → null (inherit); an explicit 0..100 override is stored as
      // a numeric string. `== null` treats both null and undefined as inherit.
      depositPercent:
        d.depositPercent == null ? null : String(d.depositPercent),
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
  // Also read the proposal's default margin (`markupPercent`) so a new item's
  // sell price is seeded from cost + default margin, not left equal to cost.
  const parent = await db.query.product.findFirst({
    where: and(eq(product.id, productId), eq(product.agencyId, user.agencyId)),
    columns: { id: true, markupPercent: true },
  });
  if (!parent) return { ok: false, error: "Not found" };
  const d = parsed.data;
  const defaultMargin = toNumber(parent.markupPercent);
  const unitPrice = priceFromMargin(d.unitCost, defaultMargin);
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
    unitPrice: String(unitPrice),
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

const itemPricingInput = z.object({
  unitCost: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(1),
});

export type ItemPricingInput = z.input<typeof itemPricingInput>;

/**
 * Update a single line item's pricing (net cost, sell price, quantity).
 *
 * The row editor is the two-way margin device: the client turns a typed margin %
 * into a `unitPrice` (via `priceFromMargin`) and turns a typed price back into a
 * margin readout — so this action only ever persists the resolved cost/price and
 * never a margin field. Tenant is verified via the parent product.
 */
export async function updateProductItemPricing(
  itemId: string,
  input: ItemPricingInput
): Promise<ActionResult> {
  const user = await requireAgencyUser();
  const parsed = itemPricingInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid pricing" };
  }
  // Load the item and confirm its parent product belongs to the caller's agency
  // before writing — the item row carries no agencyId of its own.
  const item = await db.query.productItem.findFirst({
    where: eq(productItem.id, itemId),
    columns: { id: true, productId: true },
    with: { product: { columns: { id: true, agencyId: true } } },
  });
  if (!item || item.product.agencyId !== user.agencyId) {
    return { ok: false, error: "Not found" };
  }
  const d = parsed.data;
  await db
    .update(productItem)
    .set({
      unitCost: String(round2(d.unitCost)),
      unitPrice: String(round2(d.unitPrice)),
      quantity: d.quantity,
    })
    .where(eq(productItem.id, itemId));

  await recalcTotals(item.productId);
  revalidatePath(`/proposals/${item.productId}`);
  return { ok: true };
}

const applyMarginInput = z.object({
  marginPercent: z.coerce.number().min(0).max(100),
});

export type ApplyMarginInput = z.input<typeof applyMarginInput>;

/**
 * Rewrite every line item's `unitPrice` from its own `unitCost` at a single
 * margin %. This is the explicit "apply to all" action — it deliberately clobbers
 * individually tuned per-item margins, so the UI only ever fires it on a button
 * press, never while typing. Items with a zero cost are skipped (price left as-is).
 */
export async function applyMarginToAllItems(
  productId: string,
  input: ApplyMarginInput
): Promise<ActionResult> {
  const user = await requireAgencyUser();
  const parsed = applyMarginInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid margin" };
  }
  const p = await db.query.product.findFirst({
    where: and(eq(product.id, productId), eq(product.agencyId, user.agencyId)),
    columns: { id: true },
    with: { items: { columns: { id: true, unitCost: true, unitPrice: true } } },
  });
  if (!p) return { ok: false, error: "Not found" };

  const margin = parsed.data.marginPercent;
  // Skip zero-cost items (their price stays as-is) and items already at the
  // target price, so we only issue UPDATEs that actually change a value.
  const updates: Promise<unknown>[] = [];
  for (const item of p.items) {
    const cost = toNumber(item.unitCost);
    if (cost === 0) continue;
    const next = priceFromMargin(cost, margin);
    if (next === toNumber(item.unitPrice)) continue;
    updates.push(
      db
        .update(productItem)
        .set({ unitPrice: String(next) })
        .where(eq(productItem.id, item.id))
    );
  }
  await Promise.all(updates);

  // Persist the applied margin as the proposal's default so it seeds newly added
  // items and pre-fills the apply-to-all input on the next visit.
  await db
    .update(product)
    .set({ markupPercent: String(round2(margin)) })
    .where(and(eq(product.id, productId), eq(product.agencyId, user.agencyId)));

  await recalcTotals(productId);
  revalidatePath(`/proposals/${productId}`);
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
