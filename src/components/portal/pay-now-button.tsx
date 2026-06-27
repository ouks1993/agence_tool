"use client";

import { useState, useTransition } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createPortalPaymentLink } from "@/lib/actions/portal-payments";

/**
 * Portal "Pay now" button. Creates a Stripe Connect checkout session for the
 * outstanding balance and redirects the browser to it. Errors surface both
 * inline (below the button) and as a toast.
 */
export function PayNowButton({
  bookingId,
  amount,
}: {
  bookingId: string;
  amount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handlePay = () => {
    setError(null);
    startTransition(async () => {
      const res = await createPortalPaymentLink(bookingId, amount);
      if (res.ok && res.data?.url) {
        // Hand off to Stripe-hosted checkout.
        window.location.href = res.data.url;
      } else if (res.ok) {
        setError("Payment could not be started.");
        toast.error("Payment could not be started.");
      } else {
        setError(res.error ?? "Payment could not be started.");
        toast.error(res.error ?? "Payment could not be started.");
      }
    });
  };

  return (
    <div className="space-y-2">
      <Button onClick={handlePay} disabled={pending} className="w-full sm:w-auto">
        <CreditCard className="mr-1 size-4" />
        {pending ? "Redirecting…" : "Pay now"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
