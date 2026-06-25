import { eq } from "drizzle-orm";
import { verifyWebhookSignature } from "@/lib/billing/stripe";
import { db } from "@/lib/db";
import { agency } from "@/lib/schema";

/**
 * Stripe webhook for SaaS subscription billing (vendor → agency).
 *
 * Reconciles each agency's subscription state from Stripe events. Must read the
 * RAW request body for signature verification, so we use `req.text()` (never
 * `req.json()`), which is why this route can't use the Next.js body parser.
 */

type StripeSubscription = {
  id: string;
  status: string;
  customer: string;
  current_period_end?: number;
  trial_end?: number | null;
  metadata?: { agencyId?: string };
  items?: { data?: Array<{ price?: { id?: string } }> };
};

const unixToDate = (s?: number | null): Date | null =>
  s ? new Date(s * 1000) : null;

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Billing webhook not configured", { status: 503 });
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

  // We only act on subscription lifecycle events; everything else is acked so
  // Stripe doesn't retry.
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as unknown as StripeSubscription;
    const priceId = sub.items?.data?.[0]?.price?.id ?? null;

    const values = {
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
      priceId,
      currentPeriodEnd: unixToDate(sub.current_period_end),
      trialEndsAt: unixToDate(sub.trial_end),
    };

    // Prefer the agency id stamped in subscription metadata; fall back to the
    // Stripe customer id we stored at provisioning time.
    if (sub.metadata?.agencyId) {
      await db
        .update(agency)
        .set(values)
        .where(eq(agency.id, sub.metadata.agencyId));
    } else if (sub.customer) {
      await db
        .update(agency)
        .set(values)
        .where(eq(agency.stripeCustomerId, sub.customer));
    }
  }

  return new Response("ok", { status: 200 });
}
