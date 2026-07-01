"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { canManagePayments } from "@/lib/domain";
import { getServerEnv } from "@/lib/env";
import {
  createConnectAccount,
  createConnectCheckoutSession,
  createConnectOnboardingLink,
  createStripeCheckoutLink,
  getConnectAccountStatus,
  isStripeConfigured,
} from "@/lib/payments/stripe";
import { requireAgencyUser } from "@/lib/permissions";
import { agency, booking, payment } from "@/lib/schema";

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

  if (!canManagePayments(user.role)) {
    return { ok: false, error: "You don't have permission to manage payments" };
  }

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

  if (!canManagePayments(user.role)) {
    return { ok: false, error: "You don't have permission to manage payments" };
  }

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

  if (!canManagePayments(user.role)) {
    return { ok: false, error: "You don't have permission to manage payments" };
  }

  if (!isStripeConfigured()) {
    return { ok: false, error: "Stripe is not configured. Add STRIPE_SECRET_KEY to .env." };
  }
  const b = await db.query.booking.findFirst({
    where: and(eq(booking.id, bookingId), eq(booking.agencyId, user.agencyId)),
  });
  if (!b) return { ok: false, error: "Booking not found" };

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Prefer Stripe Connect when the agency has finished onboarding: funds route
  // to the agency's own account and the platform takes a fee at the source.
  const ag = await db.query.agency.findFirst({
    where: eq(agency.id, user.agencyId),
  });

  try {
    if (ag?.stripeConnectAccountId && ag.stripeConnectOnboarded) {
      const session = await createConnectCheckoutSession({
        // Stripe expects minor units (cents).
        amount: Math.round(amount * 100),
        currency: b.currency,
        description: `Booking ${b.reference}`,
        successUrl: `${base}/bookings/${bookingId}?paid=1`,
        cancelUrl: `${base}/bookings/${bookingId}`,
        connectedAccountId: ag.stripeConnectAccountId,
        platformFeePercent: getServerEnv().STRIPE_PLATFORM_FEE_PERCENT,
      });

      // Record a pending payment so the webhook can reconcile it on completion.
      await db.insert(payment).values({
        bookingId,
        amount: String(amount),
        currency: b.currency,
        kind: "payment",
        method: "stripe",
        status: "pending",
        stripeSessionId: session.id,
        checkoutUrl: session.url,
        createdById: user.id,
      });

      return { ok: true, data: { url: session.url } };
    }

    // Fallback: non-Connect Checkout (funds land in the platform account).
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

/**
 * Starts (or resumes) Stripe Connect onboarding for the agency. Admin-only.
 * Creates the Express account if needed, persists its id, then returns a hosted
 * onboarding Account Link the admin is redirected to.
 */
export async function connectStripeAccount(): Promise<
  ActionResult<{ url: string }>
> {
  const user = await requireAgencyUser();
  if (user.role !== "admin") {
    return { ok: false, error: "Only admins can connect Stripe." };
  }
  if (!isStripeConfigured()) {
    return { ok: false, error: "Stripe is not configured. Add STRIPE_SECRET_KEY to .env." };
  }

  const ag = await db.query.agency.findFirst({
    where: eq(agency.id, user.agencyId),
  });
  if (!ag) return { ok: false, error: "Agency not found" };
  if (ag.stripeConnectAccountId && ag.stripeConnectOnboarded) {
    return { ok: false, error: "Already connected" };
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    let accountId = ag.stripeConnectAccountId;
    if (!accountId) {
      const account = await createConnectAccount({
        // The agency has no email column; use the admin's email as the account
        // contact for onboarding.
        email: user.email,
        agencyName: ag.name,
        agencyId: ag.id,
      });
      accountId = account.id;
      await db
        .update(agency)
        .set({ stripeConnectAccountId: accountId })
        .where(eq(agency.id, ag.id));
    }

    const link = await createConnectOnboardingLink({
      accountId,
      returnUrl: `${base}/api/stripe/connect/return`,
      refreshUrl: `${base}/api/stripe/connect/refresh`,
    });
    return { ok: true, data: { url: link.url } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Stripe error" };
  }
}

/**
 * Reconciles onboarding status after the admin returns from Stripe. Marks the
 * agency as onboarded once charges are enabled on the connected account.
 */
export async function completeStripeOnboarding(): Promise<ActionResult> {
  const user = await requireAgencyUser();
  if (user.role !== "admin") {
    return { ok: false, error: "Only admins can manage Stripe." };
  }

  const ag = await db.query.agency.findFirst({
    where: eq(agency.id, user.agencyId),
  });
  if (!ag?.stripeConnectAccountId) {
    return { ok: false, error: "No Stripe account to verify." };
  }

  try {
    const status = await getConnectAccountStatus(ag.stripeConnectAccountId);
    if (status.chargesEnabled) {
      await db
        .update(agency)
        .set({ stripeConnectOnboarded: true })
        .where(eq(agency.id, ag.id));
    }
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Stripe error" };
  }
}
