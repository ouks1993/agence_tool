"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { depositAmount, effectiveDepositPercent } from "@/lib/payments/deposit";
import { isStripeConfigured } from "@/lib/payments/stripe";
import { createConnectCheckoutSession } from "@/lib/payments/stripe";
import { paymentSummary } from "@/lib/payments/summary";
import { requirePortalSession } from "@/lib/portal-session";
import { agency, booking, payment } from "@/lib/schema";

/** Round to 2 decimal places (cents) before charging — matches `round2` used across actions. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Finite-guarded coercion: a non-finite value resolves to `fallback`. */
function finite(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

/**
 * The traveler is offered exactly two server-computed options:
 * - `"deposit"` — the remainder needed to REACH the agency's deposit threshold.
 * - `"full"`    — the full outstanding balance.
 *
 * The amount is NEVER supplied by the client; it is always recomputed here.
 */
const optionSchema = z.enum(["deposit", "full"]);

/**
 * Portal-scoped payment action.
 *
 * Authorization is via the portal session (client identity), NOT requireAgencyUser.
 * Ownership is verified: booking.clientId === session.client.id AND
 * booking.agencyId === session.client.agencyId.
 *
 * Only available when the agency has completed Stripe Connect onboarding.
 *
 * The traveler picks a payment *option* (deposit or full); the charge amount is
 * computed server-side from the booking total, completed payments, and the
 * agency's deposit percentage — a client-supplied amount is never trusted.
 */
export async function createPortalPaymentLink(
  bookingId: string,
  option: "deposit" | "full"
): Promise<ActionResult<{ url: string }>> {
  const session = await requirePortalSession();

  const parsedOption = optionSchema.safeParse(option);
  if (!parsedOption.success) {
    return { ok: false, error: "Invalid payment option." };
  }
  const paymentOption = parsedOption.data;

  if (!isStripeConfigured()) {
    return { ok: false, error: "Online payments are not available at this time." };
  }

  // Strict ownership: booking must belong to this client AND this agency.
  // Load the payments relation so the amount can be derived server-side.
  const b = await db.query.booking.findFirst({
    where: and(
      eq(booking.id, bookingId),
      eq(booking.clientId, session.client.id),
      eq(booking.agencyId, session.client.agencyId)
    ),
    with: {
      payments: { columns: { amount: true, kind: true, status: true } },
    },
  });
  if (!b) return { ok: false, error: "Booking not found." };

  // Load the agency's Connect account — required for portal self-pay.
  // We do NOT fall back to the platform account: funds must reach the agency.
  // `depositPercent` drives the server-side deposit computation.
  const ag = await db.query.agency.findFirst({
    where: eq(agency.id, session.client.agencyId),
    columns: {
      stripeConnectAccountId: true,
      stripeConnectOnboarded: true,
      depositPercent: true,
    },
  });

  if (!ag?.stripeConnectAccountId || !ag.stripeConnectOnboarded) {
    return {
      ok: false,
      error: "Online payments are not available for this agency yet. Please contact your agent.",
    };
  }

  // ---- Server-side amount computation (never trust a client amount) ----
  // total: finite-guarded coercion of the stored numeric string.
  const total = finite(parseFloat(b.totalAmount ?? "0"), 0);
  // paid: only completed rows count (pending rows must NOT count as paid),
  // refunds subtracted — via the shared paymentSummary helper.
  const { paid, balance } = paymentSummary(b.payments, total);
  // Deposit % resolves the override chain: the booking's snapshotted override
  // (frozen at conversion) falls back to the agency default.
  const depositPercent = effectiveDepositPercent(
    b.depositPercent,
    ag.depositPercent
  );

  let amount: number;
  let kind: "deposit" | "payment";

  if (paymentOption === "deposit") {
    // Remainder needed to REACH the deposit threshold (never below zero).
    amount = round2(Math.max(0, depositAmount(total, depositPercent) - paid));
    if (amount <= 0) {
      return {
        ok: false,
        error: "Your deposit is already covered — you can pay the remaining balance.",
      };
    }
    kind = "deposit";
  } else {
    // Full outstanding balance.
    amount = round2(balance);
    if (amount <= 0.01) {
      return { ok: false, error: "This booking is fully paid." };
    }
    kind = "payment";
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
      kind,
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
