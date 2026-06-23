"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/permissions";
import { product, productItem } from "@/lib/schema";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function nextReference(): Promise<string> {
  const count = await db.$count(product);
  return `PRD-${1001 + count}`;
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
  for (const item of p.items) {
    const cost = parseFloat(item.unitCost || "0") * item.quantity;
    totalCost += cost;
    const unitPrice = round2(parseFloat(item.unitCost || "0") * (1 + markup / 100));
    if (unitPrice !== parseFloat(item.unitPrice || "0")) {
      await db
        .update(productItem)
        .set({ unitPrice: String(unitPrice) })
        .where(eq(productItem.id, item.id));
    }
  }
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
  currency: z.string().trim().min(1).max(8).default("EUR"),
  markupPercent: z.coerce.number().min(0).max(100).default(0),
  summary: z.string().trim().max(20000).optional(),
  validUntil: z.string().optional(),
});

export type ProductInput = z.input<typeof productInput>;

export async function createProduct(
  input: ProductInput
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = productInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;
  const reference = await nextReference();

  const [row] = await db
    .insert(product)
    .values({
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

  if (!row) return { ok: false, error: "Failed to create proposal" };

  await logActivity({
    userId: user.id,
    action: "created",
    entityType: "product",
    entityId: row.id,
    entityLabel: `${reference} · ${d.title}`,
  });

  revalidatePath("/products");
  return { ok: true, data: { id: row.id } };
}

export async function updateProduct(
  id: string,
  input: ProductInput
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = productInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;
  const existing = await db.query.product.findFirst({ where: eq(product.id, id) });
  if (!existing) return { ok: false, error: "Proposal not found" };

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
    .where(eq(product.id, id));

  await recalcTotals(id);

  await logActivity({
    userId: user.id,
    action: "updated",
    entityType: "product",
    entityId: id,
    entityLabel: `${existing.reference} · ${d.title}`,
  });

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { ok: true };
}

export async function setProductStatus(
  id: string,
  status: "draft" | "sent" | "accepted" | "rejected" | "expired"
): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await db.query.product.findFirst({ where: eq(product.id, id) });
  if (!existing) return { ok: false, error: "Proposal not found" };

  await db.update(product).set({ status }).where(eq(product.id, id));

  await logActivity({
    userId: user.id,
    action: status === "sent" ? "sent" : "status_changed",
    entityType: "product",
    entityId: id,
    entityLabel: `${existing.reference} · ${existing.title}`,
    metadata: { to: status },
  });

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await db.query.product.findFirst({ where: eq(product.id, id) });
  if (!existing) return { ok: false, error: "Proposal not found" };
  if (user.role !== "manager" && existing.createdById !== user.id) {
    return { ok: false, error: "You don't have permission to delete this" };
  }

  await db.delete(product).where(eq(product.id, id));

  await logActivity({
    userId: user.id,
    action: "deleted",
    entityType: "product",
    entityId: id,
    entityLabel: `${existing.reference} · ${existing.title}`,
  });

  revalidatePath("/products");
  return { ok: true };
}

// --- Items ------------------------------------------------------------------

const itemInput = z.object({
  type: z.enum(["flight", "hotel", "activity", "transfer", "insurance", "other"]),
  title: z.string().trim().min(1, "Title is required").max(300),
  description: z.string().trim().max(2000).optional(),
  supplier: z.string().trim().max(120).optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  unitCost: z.coerce.number().min(0).default(0),
  currency: z.string().trim().min(1).max(8).default("EUR"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  details: z.unknown().optional(),
});

export type ItemInput = z.input<typeof itemInput>;

export async function addProductItem(
  productId: string,
  input: ItemInput
): Promise<ActionResult> {
  await requireUser();
  const parsed = itemInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid item" };
  }
  const d = parsed.data;
  const count = await db.$count(productItem, eq(productItem.productId, productId));

  await db.insert(productItem).values({
    productId,
    type: d.type,
    title: d.title,
    description: d.description || null,
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
  revalidatePath(`/products/${productId}`);
  return { ok: true };
}

export async function removeProductItem(
  itemId: string,
  productId: string
): Promise<ActionResult> {
  await requireUser();
  await db.delete(productItem).where(eq(productItem.id, itemId));
  await recalcTotals(productId);
  revalidatePath(`/products/${productId}`);
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
  const user = await requireUser();
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

  const res = await addProductItem(productId, input.item);
  if (!res.ok) return res;

  await logActivity({
    userId: user.id,
    action: "updated",
    entityType: "product",
    entityId: productId,
    entityLabel: input.item.title,
    metadata: { itemAdded: input.item.type },
  });

  revalidatePath(`/products/${productId}`);
  return { ok: true, data: { productId } };
}
