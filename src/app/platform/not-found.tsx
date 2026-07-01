import Link from "next/link";
import { Building2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";

// Console-styled 404 for the vendor area. Renders inside the platform layout
// (dark-ink rail) so a stale agency link stays in-context instead of falling
// through to the tenant/marketing global 404.
export default async function PlatformNotFound() {
  const t = await getTranslations("platform.notFound");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
      <EmptyState
        icon={Building2}
        title={t("title")}
        description={t("description")}
        action={
          <Button asChild>
            <Link href="/platform">{t("back")}</Link>
          </Button>
        }
      />
    </div>
  );
}
