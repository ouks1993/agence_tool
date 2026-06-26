import { redirect } from "next/navigation";
import { completeStripeOnboarding } from "@/lib/actions/payments";

/**
 * Stripe redirects the admin here after finishing Connect onboarding. We refresh
 * the onboarding status, then bounce back to Settings with a result flag.
 */
export async function GET(): Promise<never> {
  const result = await completeStripeOnboarding();
  redirect(result.ok ? "/settings?connect=success" : "/settings?connect=error");
}
