"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-6">
      <EmptyState
        icon={AlertTriangle}
        title={t("title")}
        description={t("portalDescription")}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={reset}>
              <RefreshCw className="mr-2 size-4" />
              {t("tryAgain")}
            </Button>
            <Button variant="outline" onClick={() => (window.location.href = "/portal/login")}>
              {t("backToSignIn")}
            </Button>
          </div>
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
