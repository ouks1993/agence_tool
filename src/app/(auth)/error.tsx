"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error("Auth error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <EmptyState
          icon={AlertTriangle}
          title={t("title")}
          description={t("authDescription")}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={reset}>
                <RefreshCw className="mr-2 size-4" />
                {t("tryAgain")}
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = "/login")}>
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
    </div>
  );
}
