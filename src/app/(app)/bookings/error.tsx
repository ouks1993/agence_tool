"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";

export default function BookingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error("Bookings error:", error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <EmptyState
        icon={AlertTriangle}
        title={t("title")}
        description={t("appDescription")}
        action={
          <Button onClick={reset}>
            <RefreshCw className="mr-2 size-4" />
            {t("tryAgain")}
          </Button>
        }
      />
      {error.digest && (
        <p className="text-muted-foreground text-center text-xs">
          {t("errorId")}: {error.digest}
        </p>
      )}
    </div>
  );
}
