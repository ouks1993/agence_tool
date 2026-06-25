"use client";

import { useTransition } from "react";
import { CreditCard, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { openBillingPortal, startSubscriptionCheckout } from "@/lib/actions/billing";

/**
 * Subscribe / Manage buttons for the agency billing page. Each calls a server
 * action that returns a hosted Stripe URL, then redirects the browser there.
 */
export function BillingActions({ hasCustomer }: { hasCustomer: boolean }) {
  const [pending, startTransition] = useTransition();

  const go = (action: () => Promise<{ ok: boolean; error?: string; data?: { url: string } }>) =>
    startTransition(async () => {
      const res = await action();
      if (res.ok && res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      toast.error(res.error ?? "Something went wrong.");
    });

  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={() => go(startSubscriptionCheckout)} disabled={pending}>
        <CreditCard className="mr-1 size-4" />
        {hasCustomer ? "Change plan" : "Subscribe"}
      </Button>
      {hasCustomer && (
        <Button variant="outline" onClick={() => go(openBillingPortal)} disabled={pending}>
          <ExternalLink className="mr-1 size-4" />
          Manage billing
        </Button>
      )}
    </div>
  );
}
