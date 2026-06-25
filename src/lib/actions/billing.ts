"use server";

import { eq } from "drizzle-orm";
import type { ActionResult } from "@/lib/actions/types";
import {
  createBillingCustomer,
  createBillingPortalSession,
  createSubscriptionCheckout,
  isBillingConfigured,
} from "@/lib/billing/stripe";
import { db } from "@/lib/db";
import { requireAgencyUser } from "@/lib/permissions";
import { agency } from "@/lib/schema";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** Billing is admin-only — a manager cannot change the agency's subscription. */
async function requireBillingAdmin() {
  const me = await requireAgencyUser();
  if (me.role !== "admin") return null;
  return me;
}

/**
 * Starts a Stripe Checkout (subscription) for the current agency and returns the
 * hosted URL. Lazily provisions a Stripe customer if one doesn't exist yet.
 */
export async function startSubscriptionCheckout(): Promise<
  ActionResult<{ url: string }>
> {
  const me = await requireBillingAdmin();
  if (!me) return { ok: false, error: "Only an admin can manage billing." };

  if (!isBillingConfigured() || !process.env.STRIPE_PRICE_ID) {
    return { ok: false, error: "Billing is not configured." };
  }

  const ag = await db.query.agency.findFirst({
    where: eq(agency.id, me.agencyId),
    columns: { id: true, name: true, stripeCustomerId: true },
  });
  if (!ag) return { ok: false, error: "Agency not found." };

  let customerId = ag.stripeCustomerId;
  if (!customerId) {
    try {
      const customer = await createBillingCustomer({
        name: ag.name,
        email: me.email,
        agencyId: ag.id,
      });
      customerId = customer.id;
      await db
        .update(agency)
        .set({ stripeCustomerId: customerId })
        .where(eq(agency.id, ag.id));
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Could not start billing.",
      };
    }
  }

  try {
    const { url } = await createSubscriptionCheckout({
      customerId,
      priceId: process.env.STRIPE_PRICE_ID,
      successUrl: `${APP_URL}/billing?status=success`,
      cancelUrl: `${APP_URL}/billing?status=cancelled`,
      agencyId: ag.id,
    });
    return { ok: true, data: { url } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not start checkout.",
    };
  }
}

/** Opens the Stripe Billing Portal so the agency can manage/cancel its plan. */
export async function openBillingPortal(): Promise<ActionResult<{ url: string }>> {
  const me = await requireBillingAdmin();
  if (!me) return { ok: false, error: "Only an admin can manage billing." };

  const ag = await db.query.agency.findFirst({
    where: eq(agency.id, me.agencyId),
    columns: { stripeCustomerId: true },
  });
  if (!ag?.stripeCustomerId) {
    return { ok: false, error: "No billing account yet. Start a subscription first." };
  }

  try {
    const { url } = await createBillingPortalSession({
      customerId: ag.stripeCustomerId,
      returnUrl: `${APP_URL}/billing`,
    });
    return { ok: true, data: { url } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not open billing portal.",
    };
  }
}
