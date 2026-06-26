import { eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { LanguageSelector } from "@/components/settings/language-selector";
import { ProfileForm } from "@/components/settings/profile-form";
import { StripeConnect } from "@/components/settings/stripe-connect";
import { ThemeSelector } from "@/components/settings/theme-selector";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db";
import { isStripeConfigured } from "@/lib/payments/stripe";
import { requireAgencyUser } from "@/lib/permissions";
import { agency } from "@/lib/schema";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const locale = await getLocale();
  const user = await requireAgencyUser();

  // Payments (Stripe Connect) is an admin-only, stripe-configured concern.
  const showPayments = user.role === "admin" && isStripeConfigured();
  const ag = showPayments
    ? await db.query.agency.findFirst({ where: eq(agency.id, user.agencyId) })
    : null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <PageHeader title={t("title")} description={t("description")} />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("language")}</CardTitle>
            <CardDescription>{t("languageDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <LanguageSelector current={locale} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("theme")}</CardTitle>
            <CardDescription>{t("themeDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeSelector />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("profile")}</CardTitle>
            <CardDescription>{t("profileDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm name={user.name} email={user.email} />
          </CardContent>
        </Card>

        {showPayments && ag ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payments</CardTitle>
              <CardDescription>
                Connect Stripe to collect client payments directly to your
                agency&apos;s bank account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StripeConnect
                onboarded={ag.stripeConnectOnboarded}
                accountId={ag.stripeConnectAccountId}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
