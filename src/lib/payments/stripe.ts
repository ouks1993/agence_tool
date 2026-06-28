/**
 * Stripe payment adapter.
 *
 * Active only when STRIPE_SECRET_KEY is set. Uses the Stripe REST API directly
 * via fetch (no SDK dependency) to create a hosted Checkout link the agent can
 * send to the client. Without a key, the app records payments manually.
 */

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Hard cap on any Stripe call so a hung upstream can't pin a request to
 * Vercel's 30s function ceiling. */
const FETCH_TIMEOUT_MS = 15000;

/**
 * `fetch` wrapper that aborts after FETCH_TIMEOUT_MS. On timeout it throws a
 * clear error so the caller's existing error handling surfaces it instead of
 * hanging. The timer is always cleared in `finally`.
 */
async function stripeFetch(
  url: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Stripe request timed out after ${FETCH_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createStripeCheckoutLink(params: {
  amount: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; id: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured");

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", params.successUrl);
  body.set("cancel_url", params.cancelUrl);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", params.currency.toLowerCase());
  body.set("line_items[0][price_data][product_data][name]", params.description);
  body.set("line_items[0][price_data][unit_amount]", String(Math.round(params.amount * 100)));

  const res = await stripeFetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Stripe error (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { id: string; url: string };
  return { url: data.url, id: data.id };
}

// ---------------------------------------------------------------------------
// Stripe Connect (Express) — agencies receive client booking payments directly
// to their own bank account, with the platform taking a fee at the source via
// destination charges. All calls use the same raw-fetch pattern as above.
// ---------------------------------------------------------------------------

const STRIPE_API = "https://api.stripe.com/v1";

/** POST helper for the Stripe Connect calls (mirrors createStripeCheckoutLink). */
async function stripePost<T>(path: string, body: URLSearchParams): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured");
  const res = await stripeFetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Stripe error (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/** Creates a Stripe Express Connect account for an agency. */
export async function createConnectAccount(params: {
  email: string;
  agencyName: string;
  agencyId: string;
}): Promise<{ id: string }> {
  const body = new URLSearchParams();
  body.set("type", "express");
  body.set("email", params.email);
  body.set("business_profile[name]", params.agencyName);
  body.set("metadata[agencyId]", params.agencyId);
  return stripePost<{ id: string }>("/accounts", body);
}

/** Generates an onboarding Account Link the admin follows to finish setup. */
export async function createConnectOnboardingLink(params: {
  accountId: string;
  returnUrl: string;
  refreshUrl: string;
}): Promise<{ url: string }> {
  const body = new URLSearchParams();
  body.set("account", params.accountId);
  body.set("refresh_url", params.refreshUrl);
  body.set("return_url", params.returnUrl);
  body.set("type", "account_onboarding");
  return stripePost<{ url: string }>("/account_links", body);
}

/** Returns whether a connected account can take charges / receive payouts. */
export async function getConnectAccountStatus(
  accountId: string
): Promise<{ chargesEnabled: boolean; payoutsEnabled: boolean }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured");
  const res = await stripeFetch(`${STRIPE_API}/accounts/${accountId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Stripe error (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    charges_enabled: boolean;
    payouts_enabled: boolean;
  };
  return {
    chargesEnabled: data.charges_enabled,
    payoutsEnabled: data.payouts_enabled,
  };
}

/**
 * Creates a hosted Checkout session as a destination charge: the client pays
 * the platform, which forwards the funds to the connected account minus an
 * application fee. `amount` is in minor units (cents).
 */
export async function createConnectCheckoutSession(params: {
  amount: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  connectedAccountId: string;
  platformFeePercent: number;
}): Promise<{ url: string; id: string }> {
  // Application fee is taken from the gross amount, rounded to whole cents.
  const applicationFee = Math.round(
    (params.amount * params.platformFeePercent) / 100
  );

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", params.successUrl);
  body.set("cancel_url", params.cancelUrl);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", params.currency.toLowerCase());
  body.set(
    "line_items[0][price_data][product_data][name]",
    params.description
  );
  body.set("line_items[0][price_data][unit_amount]", String(params.amount));
  body.set(
    "payment_intent_data[application_fee_amount]",
    String(applicationFee)
  );
  body.set(
    "payment_intent_data[transfer_data][destination]",
    params.connectedAccountId
  );

  const data = await stripePost<{ id: string; url: string }>(
    "/checkout/sessions",
    body
  );
  return { url: data.url, id: data.id };
}
