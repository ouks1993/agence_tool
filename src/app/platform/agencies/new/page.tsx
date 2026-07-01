import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { CreateAgencyForm } from "@/components/platform/create-agency-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/permissions";

export const metadata = { title: "New agency" };

export default async function NewAgencyPage() {
  // Guard: only the platform super-admin may provision agencies.
  await requirePlatformAdmin();
  const t = await getTranslations("platform.new");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/platform">
          <ArrowLeft className="mr-1 size-4" />
          {t("back")}
        </Link>
      </Button>
      <PageHeader title={t("title")} description={t("description")} />
      <Card>
        <CardContent className="p-6">
          <CreateAgencyForm />
        </CardContent>
      </Card>
    </div>
  );
}
