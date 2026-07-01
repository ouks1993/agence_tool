"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";

export default function PortalProposalsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error("Portal proposals error:", error);
  }, [error]);

  return (
    <div className="space-y-6">
      <EmptyState
        icon={AlertTriangle}
        title={t("title")}
        description={t("portalDescription")}
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
