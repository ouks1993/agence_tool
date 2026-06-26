import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-md mx-auto text-center">
        <div className="flex justify-center mb-6">
          <FileQuestion className="h-16 w-16 text-muted-foreground" />
        </div>
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <h2 className="text-xl font-semibold mb-4">{t("notFound")}</h2>
        <p className="text-muted-foreground mb-6">{t("notFoundDesc")}</p>
        <div className="flex gap-4 justify-center">
          <Button asChild>
            <Link href="/">{t("backHome")}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
