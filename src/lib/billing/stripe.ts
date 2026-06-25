/**
 * SaaS billing adapter (vendor → agency subscriptions).
 *
 * This is the billing plane where the PLATFORM charges each AGENCY a recurring
 * subscription. It is intentionally separate from `src/lib/payments/stripe.ts`,
 * which is the traveler → agency booking-payment plane.
 *
 * Active only when STRIPE_SECRET_KEY is set. Uses the Stripe REST API directly
 * via fetch (no SDK), matching the existing payments adapter. Webhook signatures
 * are verified manually with Node crypto.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const STRIPE_API = "https://api.stripe.com/v1";

export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Stripe subscription states that should lock an agency out of the app. */
export const BLOCKING_SUBSCRIPTION_STATUSES = [
  "canceled",
  "unpaid",
  "incomplete_expired",
] as const;

/** True when a subscription status should block access (NULL/trialing/active are fine). */
export function isSubscriptionBlocking(status: string | null | undefined): boolean {
  return Boolean(
    status && (BLOCKING_SUBSCRIPTION_STATUSES as readonly string[]).includes(status)
  );
}

async function stripePost<T>(path: string, form: URLSearchParams): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe billing is not configured");
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Stripe billing error (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/** Creates a Stripe customer for an agency (the bill payer). */
export async function createBillingCustomer(params: {
  name: string;
  email: string;
  agencyId: string;
}): Promise<{ id: string }> {
  const form = new URLSearchParams();
  form.set("name", params.name);
  form.set("email", params.email);
  form.set("metadata[agencyId]", params.agencyId);
  return stripePost<{ id: string }>("/customers", form);
}

/**
 * Creates a hosted Checkout session in subscription mode. The agency admin
 * completes payment there; the resulting subscription is reconciled by webhook.
 */
export async function createSubscriptionCheckout(params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  agencyId: string;
  trialDays?: number;
}): Promise<{ url: string; id: string }> {
  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("customer", params.customerId);
  form.set("line_items[0][price]", params.priceId);
  form.set("line_items[0][quantity]", "1");
  form.set("success_url", params.successUrl);
  form.set("cancel_url", params.cancelUrl);
  form.set("subscription_data[metadata][agencyId]", params.agencyId);
  if (params.trialDays && params.trialDays > 0) {
    form.set("subscription_data[trial_period_days]", String(params.trialDays));
  }
  const data = await stripePost<{ id: string; url: string }>(
    "/checkout/sessions",
    form
  );
  return { url: data.url, id: data.id };
}

/** Creates a Billing Portal session so an agency can manage/cancel its plan. */
export async function createBillingPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const form = new URLSearchParams();
  form.set("customer", params.customerId);
  form.set("return_url", params.returnUrl);
  return stripePost<{ url: string }>("/billing_portal/sessions", form);
}

/** A minimal shape of the webhook events we consume. */
export type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

/**
 * Verifies a Stripe webhook signature (the `Stripe-Signature` header) against the
 * raw request body, mirroring Stripe's scheme without the SDK. Returns the parsed
 * event when valid, or null when the signature/timestamp doesn't check out.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds = 300
): StripeEvent | null {
  if (!signatureHeader) return null;

  const parts = signatureHeader.split(",").reduce<Record<string, string>>(
    (acc, part) => {
      const [k, v] = part.split("=");
      if (k && v) {
        if (k === "v1") acc[k] = acc[k] ? `${acc[k]},${v}` : v;
        else acc[k] = v;
      }
      return acc;
    },
    {}
  );

  const timestamp = parts["t"];
  const signatures = parts["v1"];
  if (!timestamp || !signatures) return null;

  // Reject stale timestamps (replay protection). Uses Stripe's header time only.
  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (!Number.isFinite(age) || Math.abs(age) > toleranceSeconds) return null;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const expectedBuf = Buffer.from(expected);

  const ok = signatures.split(",").some((sig) => {
    const sigBuf = Buffer.from(sig);
    return (
      sigBuf.length === expectedBuf.length &&
      timingSafeEqual(sigBuf, expectedBuf)
    );
  });
  if (!ok) return null;

  try {
    return JSON.parse(rawBody) as StripeEvent;
  } catch {
    return null;
  }
}
