import { redirect } from "next/navigation";
import { connectStripeAccount } from "@/lib/actions/payments";

/**
 * Stripe sends the admin here when an onboarding Account Link expires. We mint a
 * fresh link and send them straight back into the Stripe-hosted onboarding.
 */
export async function GET(): Promise<never> {
  const result = await connectStripeAccount();
  redirect(
    result.ok && result.data?.url ? result.data.url : "/settings?connect=error"
  );
}
