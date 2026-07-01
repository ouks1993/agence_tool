import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-md">
        <EmptyState
          icon={FileQuestion}
          title={t("notFound")}
          description={t("notFoundDesc")}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button asChild>
                <Link href="/">{t("backHome")}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard">{t("dashboard")}</Link>
              </Button>
            </div>
          }
        />
      </div>
    </div>
  );
}
