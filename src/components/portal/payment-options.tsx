"use client";

import { useState, useTransition } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createPortalPaymentLink } from "@/lib/actions/portal-payments";
import { formatMoney } from "@/lib/format";

/**
 * Portal payment control. Offers the traveler exactly two server-computed
 * options — pay the agency's deposit, or pay the full outstanding balance —
 * then redirects the browser to Stripe-hosted checkout.
 *
 * The amounts passed in are for DISPLAY only; each button hands the *option*
 * string to `createPortalPaymentLink`, which recomputes the real charge amount
 * server-side (a client-supplied amount is never trusted).
 *
 * Rendering:
 * - `depositDue > 0`  → primary "Pay {percent}% deposit — {money}" +
 *   secondary "Pay full balance — {money}".
 * - `depositDue <= 0` and `balance > 0` → single "Pay balance — {money}".
 *
 * Errors surface both inline (below the buttons) and as a toast.
 */
export function PaymentOptions({
  bookingId,
  balance,
  depositDue,
  depositPercent,
  currency,
}: {
  bookingId: string;
  balance: number;
  depositDue: number;
  depositPercent: number;
  currency: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const startPayment = (option: "deposit" | "full") => {
    setError(null);
    startTransition(async () => {
      const res = await createPortalPaymentLink(bookingId, option);
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

  const showDeposit = depositDue > 0;
  const percentLabel = Math.round(depositPercent);

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      {showDeposit ? (
        <>
          <Button
            onClick={() => startPayment("deposit")}
            disabled={pending}
            className="w-full sm:w-auto"
          >
            <CreditCard className="mr-1 size-4" />
            {pending
              ? "Redirecting…"
              : `Pay ${percentLabel}% deposit — ${formatMoney(depositDue, currency)}`}
          </Button>
          <Button
            onClick={() => startPayment("full")}
            disabled={pending}
            variant="outline"
            className="w-full sm:w-auto"
          >
            {`Pay full balance — ${formatMoney(balance, currency)}`}
          </Button>
        </>
      ) : (
        <Button
          onClick={() => startPayment("full")}
          disabled={pending}
          className="w-full sm:w-auto"
        >
          <CreditCard className="mr-1 size-4" />
          {pending ? "Redirecting…" : `Pay balance — ${formatMoney(balance, currency)}`}
        </Button>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
