import { eq } from "drizzle-orm";
import { verifyWebhookSignature } from "@/lib/billing/stripe";
import { db } from "@/lib/db";
import { payment } from "@/lib/schema";

/**
 * Stripe Connect webhook for traveler → agency booking payments.
 *
 * Reconciles the local `payment` rows created by the Connect Checkout flow. Like
 * the billing webhook, signature verification needs the RAW request body, so we
 * read `req.text()` (never `req.json()`). Configured via a dedicated endpoint
 * secret (STRIPE_CONNECT_WEBHOOK_SECRET) separate from the billing webhook.
 */

export const runtime = "nodejs";

type CheckoutSession = {
  id: string;
  payment_intent?: string;
  payment_status?: string;
};

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Webhook not configured", { status: 400 });
  }

  const rawBody = await req.text();
  const event = verifyWebhookSignature(
    rawBody,
    req.headers.get("stripe-signature"),
    secret
  );
  if (!event) {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as unknown as CheckoutSession;
    if (session.payment_status === "paid") {
      await db
        .update(payment)
        .set({ status: "completed", reference: session.payment_intent ?? null })
        .where(eq(payment.stripeSessionId, session.id));
    }
  }

  return new Response("ok", { status: 200 });
}
