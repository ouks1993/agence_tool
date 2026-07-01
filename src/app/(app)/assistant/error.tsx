"use client";

import { useEffect } from "react";
import { MessageSquareWarning, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error("Chat error:", error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <EmptyState
        icon={MessageSquareWarning}
        title={t("chatTitle")}
        description={t("chatDescription")}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={reset}>
              <RefreshCw className="mr-2 size-4" />
              {t("tryAgain")}
            </Button>
            <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
              {t("goDashboard")}
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
