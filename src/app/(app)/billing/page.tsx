import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { CreditCard } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-badge";
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

  const t = await getTranslations("billing");
  const configured = isBillingConfigured();
  const status = ag.subscriptionStatus;
  const onTrial = status === "trialing";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="mx-auto w-full max-w-2xl">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="size-5" /> Subscription
              <StatusPill
                domain="subscription"
                status={status}
                label={subscriptionLabel(status)}
                dot
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
              <EmptyState
                icon={CreditCard}
                title="Billing not configured"
                description="Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID to enable subscriptions."
              />
            ) : (
              <BillingActions hasCustomer={Boolean(ag.stripeCustomerId)} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
