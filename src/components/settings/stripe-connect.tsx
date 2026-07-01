"use client";

import { useTransition } from "react";
import { CreditCard, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { connectStripeAccount } from "@/lib/actions/payments";

/**
 * Stripe Connect management for agency admins. Lets an admin connect (or finish
 * setting up) an Express account that receives client booking payments. The
 * connect/resume flow redirects to the Stripe-hosted onboarding via a server
 * action that mints an Account Link.
 */
export function StripeConnect({
  onboarded,
  accountId,
}: {
  onboarded: boolean;
  accountId: string | null;
}) {
  const t = useTranslations("settings");
  const [pending, startTransition] = useTransition();

  const handleConnect = () => {
    startTransition(async () => {
      const res = await connectStripeAccount();
      if (res.ok && res.data?.url) {
        // Hand off to the Stripe-hosted onboarding flow.
        window.location.href = res.data.url;
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  };

  // Connected and onboarded: show status and a link to the Stripe dashboard.
  if (onboarded && accountId) {
    const dashboardUrl = `https://dashboard.stripe.com/express/${accountId}`;
    const shortId =
      accountId.length > 14 ? `${accountId.slice(0, 14)}…` : accountId;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <StatusBadge label={t("stripeConnected")} variant="success" dot />
          <code className="text-muted-foreground text-xs">{shortId}</code>
        </div>
        <Button asChild variant="outline">
          <a href={dashboardUrl} target="_blank" rel="noopener noreferrer">
            {t("stripeManagePayouts")}
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
    );
  }

  // Account exists but onboarding is incomplete: resume the Stripe flow.
  if (accountId) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">{t("stripeIncomplete")}</p>
        <Button onClick={handleConnect} disabled={pending}>
          <CreditCard className="h-4 w-4" />
          {t("stripeCompleteSetup")}
        </Button>
      </div>
    );
  }

  // No account yet: start the Connect flow.
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{t("stripeIntro")}</p>
      <Button onClick={handleConnect} disabled={pending}>
        <CreditCard className="h-4 w-4" />
        {t("stripeConnect")}
      </Button>
    </div>
  );
}
