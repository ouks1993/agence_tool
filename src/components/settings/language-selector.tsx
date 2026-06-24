"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { LOCALES, LOCALE_META } from "@/i18n/config";
import { setLocale } from "@/lib/actions/settings";
import { cn } from "@/lib/utils";

/**
 * Segmented row of the supported locales. Selecting one persists the choice via
 * the `setLocale` server action and refreshes the page so the new language and
 * text direction apply immediately.
 */
export function LanguageSelector({ current }: { current: string }) {
  const router = useRouter();
  const t = useTranslations("settings");
  const [pending, startTransition] = useTransition();

  const choose = (value: string) => {
    if (value === current || pending) return;
    startTransition(async () => {
      const res = await setLocale(value);
      if (res.ok) {
        toast.success(t("saved"));
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {LOCALES.map((locale) => {
        const meta = LOCALE_META[locale];
        const isActive = locale === current;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => choose(locale)}
            disabled={pending}
            aria-pressed={isActive}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors outline-none",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              "disabled:pointer-events-none disabled:opacity-50",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-transparent hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <span aria-hidden>{meta.flag}</span>
            <span>{meta.nativeLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
