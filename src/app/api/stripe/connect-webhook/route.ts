import { eq } from "drizzle-orm";
import { verifyWebhookSignature } from "@/lib/billing/stripe";
import { db } from "@/lib/db";
import { notifyPaymentReceived } from "@/lib/notifications/inbox";
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
    // Transient misconfiguration (endpoint secret not yet set), NOT a bad
    // request. Return 503 so Stripe keeps retrying and delivers the event
    // cleanly once the secret is configured — a 400 would tell Stripe to give
    // up permanently.
    return new Response("Webhook not configured", { status: 503 });
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
      // Guard the DB write: a transient failure must return 500 so Stripe
      // retries this (idempotent) update, rather than bubbling as an unhandled
      // rejection. Only a single update runs here, so a thrown error can't
      // partially double-apply within this invocation.
      let updated: { bookingId: string; amount: string }[];
      try {
        updated = await db
          .update(payment)
          .set({
            status: "completed",
            reference: session.payment_intent ?? null,
          })
          .where(eq(payment.stripeSessionId, session.id))
          .returning({ bookingId: payment.bookingId, amount: payment.amount });
      } catch (err) {
        console.error(
          "[stripe-webhook]",
          { type: event.type, id: event.id },
          err
        );
        return new Response("Webhook handler failed", { status: 500 });
      }

      // Best-effort in-app notification. Derives the tenant from the booking row
      // (the webhook has no session). The helper swallows its own errors, so it
      // can never change the HTTP status returned to Stripe below.
      const row = updated[0];
      if (row) {
        await notifyPaymentReceived({
          bookingId: row.bookingId,
          amount: row.amount,
        });
      }
    }
  }

  return new Response("ok", { status: 200 });
}
