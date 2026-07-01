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
      <div className="mx-auto max-w-2xl space-y-10">
        <PageHeader title={t("title")} description={t("description")} />

        {/* Preferences — interface language + theme */}
        <section className="space-y-4">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {t("sectionPreferences")}
          </h2>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-lg">{t("language")}</CardTitle>
              <CardDescription>{t("languageDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <LanguageSelector current={locale} />
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-lg">{t("theme")}</CardTitle>
              <CardDescription>{t("themeDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ThemeSelector />
            </CardContent>
          </Card>
        </section>

        {/* Account — the signed-in user's identity */}
        <section className="space-y-4">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {t("sectionAccount")}
          </h2>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-lg">{t("profile")}</CardTitle>
              <CardDescription>{t("profileDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm name={user.name} email={user.email} />
            </CardContent>
          </Card>
        </section>

        {/* Billing — admin-only Stripe Connect payouts */}
        {showPayments && ag ? (
          <section className="space-y-4">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {t("sectionBilling")}
            </h2>

            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-lg">{t("payments")}</CardTitle>
                <CardDescription>{t("paymentsDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <StripeConnect
                  onboarded={ag.stripeConnectOnboarded}
                  accountId={ag.stripeConnectAccountId}
                />
              </CardContent>
            </Card>
          </section>
        ) : null}
      </div>
    </div>
  );
}
