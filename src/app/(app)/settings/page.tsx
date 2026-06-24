import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { LanguageSelector } from "@/components/settings/language-selector";
import { ProfileForm } from "@/components/settings/profile-form";
import { ThemeSelector } from "@/components/settings/theme-selector";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAgencyUser } from "@/lib/permissions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const locale = await getLocale();
  const user = await requireAgencyUser();

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
      </div>
    </div>
  );
}
