import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { BillingActions } from "@/components/billing/billing-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isBillingConfigured } from "@/lib/billing/stripe";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requireAgencyUser } from "@/lib/permissions";
import { agency } from "@/lib/schema";

export const metadata = { title: "Billing" };

/** Tone for a Stripe subscription status badge. */
function subscriptionTone(status: string | null): string {
  if (status === "active" || status === "trialing")
    return "bg-green-500/15 text-green-600 dark:text-green-400";
  if (status === "past_due" || status === "incomplete")
    return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  if (!status) return "bg-slate-500/15 text-slate-600 dark:text-slate-300";
  return "bg-red-500/15 text-red-600 dark:text-red-400";
}

function subscriptionLabel(status: string | null): string {
  if (!status) return "No subscription";
  return status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export default async function BillingPage() {
  const me = await requireAgencyUser();
  // Billing is admin-only.
  if (me.role !== "admin") redirect("/dashboard");

  const ag = await db.query.agency.findFirst({
    where: eq(agency.id, me.agencyId),
    columns: {
      name: true,
      stripeCustomerId: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      trialEndsAt: true,
    },
  });
  if (!ag) redirect("/dashboard");

  const configured = isBillingConfigured();
  const status = ag.subscriptionStatus;
  const onTrial = status === "trialing";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <PageHeader
          title="Billing"
          description="Manage your agency's subscription."
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="size-5" /> Subscription
              <StatusBadge
                label={subscriptionLabel(status)}
                tone={subscriptionTone(status)}
              />
            </CardTitle>
            <CardDescription>
              {onTrial
                ? ag.trialEndsAt
                  ? `Your free trial ends on ${formatDate(ag.trialEndsAt)}.`
                  : "You're on a free trial."
                : status === "active"
                  ? ag.currentPeriodEnd
                    ? `Your plan renews on ${formatDate(ag.currentPeriodEnd)}.`
                    : "Your subscription is active."
                  : "Subscribe to keep using your agency workspace."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!configured ? (
              <p className="text-muted-foreground text-sm">
                Billing isn&apos;t configured yet. Set <code>STRIPE_SECRET_KEY</code> and{" "}
                <code>STRIPE_PRICE_ID</code> to enable subscriptions.
              </p>
            ) : (
              <BillingActions hasCustomer={Boolean(ag.stripeCustomerId)} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
