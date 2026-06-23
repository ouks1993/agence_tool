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

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
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
