"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { createStripeCheckoutLink, isStripeConfigured } from "@/lib/payments/stripe";
import { requireAgencyUser } from "@/lib/permissions";
import { booking, payment } from "@/lib/schema";

const paymentInput = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  kind: z.enum(["deposit", "installment", "payment", "refund"]),
  method: z.enum(["manual", "card", "transfer", "cash", "stripe"]).default("manual"),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
});

export type PaymentInput = z.input<typeof paymentInput>;

export async function recordPayment(
  bookingId: string,
  input: PaymentInput
): Promise<ActionResult> {
  const user = await requireAgencyUser();
  const parsed = paymentInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payment" };
  }
  const d = parsed.data;
  const b = await db.query.booking.findFirst({
    where: and(eq(booking.id, bookingId), eq(booking.agencyId, user.agencyId)),
  });
  if (!b) return { ok: false, error: "Booking not found" };

  await db.insert(payment).values({
    bookingId,
    amount: String(d.amount),
    currency: b.currency,
    kind: d.kind,
    method: d.method,
    status: "completed",
    reference: d.reference || null,
    note: d.note || null,
    createdById: user.id,
  });

  await logActivity({
    agencyId: user.agencyId,
    userId: user.id,
    action: "updated",
    entityType: "booking",
    entityId: bookingId,
    entityLabel: b.reference,
    metadata: { payment: d.kind, amount: d.amount },
  });

  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

export async function deletePayment(
  id: string,
  bookingId: string
): Promise<ActionResult> {
  const user = await requireAgencyUser();
  // Verify the parent booking belongs to this agency before deleting its payment.
  const b = await db.query.booking.findFirst({
    where: and(eq(booking.id, bookingId), eq(booking.agencyId, user.agencyId)),
  });
  if (!b) return { ok: false, error: "Not found" };

  await db
    .delete(payment)
    .where(and(eq(payment.id, id), eq(payment.bookingId, bookingId)));
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

/** Creates a Stripe Checkout link for the given amount (requires STRIPE_SECRET_KEY). */
export async function createPaymentLink(
  bookingId: string,
  amount: number
): Promise<ActionResult<{ url: string }>> {
  const user = await requireAgencyUser();
  if (!isStripeConfigured()) {
    return { ok: false, error: "Stripe is not configured. Add STRIPE_SECRET_KEY to .env." };
  }
  const b = await db.query.booking.findFirst({
    where: and(eq(booking.id, bookingId), eq(booking.agencyId, user.agencyId)),
  });
  if (!b) return { ok: false, error: "Booking not found" };

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const { url } = await createStripeCheckoutLink({
      amount,
      currency: b.currency,
      description: `Booking ${b.reference}`,
      successUrl: `${base}/bookings/${bookingId}?paid=1`,
      cancelUrl: `${base}/bookings/${bookingId}`,
    });
    return { ok: true, data: { url } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Stripe error" };
  }
}
