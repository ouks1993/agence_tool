"use server";

import { and, eq } from "drizzle-orm";
import type { ActionResult } from "@/lib/actions/types";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { isStripeConfigured } from "@/lib/payments/stripe";
import { createConnectCheckoutSession } from "@/lib/payments/stripe";
import { requirePortalSession } from "@/lib/portal-session";
import { agency, booking, payment } from "@/lib/schema";

/**
 * Portal-scoped payment action.
 *
 * Authorization is via the portal session (client identity), NOT requireAgencyUser.
 * Ownership is verified: booking.clientId === session.client.id AND
 * booking.agencyId === session.client.agencyId.
 *
 * Only available when the agency has completed Stripe Connect onboarding.
 */
export async function createPortalPaymentLink(
  bookingId: string,
  amount: number
): Promise<ActionResult<{ url: string }>> {
  const session = await requirePortalSession();

  if (!isStripeConfigured()) {
    return { ok: false, error: "Online payments are not available at this time." };
  }

  if (amount <= 0) {
    return { ok: false, error: "Payment amount must be greater than zero." };
  }

  // Strict ownership: booking must belong to this client AND this agency.
  const b = await db.query.booking.findFirst({
    where: and(
      eq(booking.id, bookingId),
      eq(booking.clientId, session.client.id),
      eq(booking.agencyId, session.client.agencyId)
    ),
  });
  if (!b) return { ok: false, error: "Booking not found." };

  // Load the agency's Connect account — required for portal self-pay.
  // We do NOT fall back to the platform account: funds must reach the agency.
  const ag = await db.query.agency.findFirst({
    where: eq(agency.id, session.client.agencyId),
    columns: {
      stripeConnectAccountId: true,
      stripeConnectOnboarded: true,
    },
  });

  if (!ag?.stripeConnectAccountId || !ag.stripeConnectOnboarded) {
    return {
      ok: false,
      error: "Online payments are not available for this agency yet. Please contact your agent.",
    };
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const checkoutSession = await createConnectCheckoutSession({
      amount: Math.round(amount * 100),
      currency: b.currency,
      description: `Booking ${b.reference}`,
      successUrl: `${base}/portal/bookings/${bookingId}?paid=1`,
      cancelUrl: `${base}/portal/bookings/${bookingId}`,
      connectedAccountId: ag.stripeConnectAccountId,
      platformFeePercent: getServerEnv().STRIPE_PLATFORM_FEE_PERCENT,
    });

    // Record a pending payment row — the Connect webhook reconciles it on completion.
    await db.insert(payment).values({
      bookingId,
      amount: String(amount),
      currency: b.currency,
      kind: "payment",
      method: "stripe",
      status: "pending",
      stripeSessionId: checkoutSession.id,
      checkoutUrl: checkoutSession.url,
      // No createdById — portal clients are not staff users.
    });

    return { ok: true, data: { url: checkoutSession.url } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Payment session could not be created.",
    };
  }
}
