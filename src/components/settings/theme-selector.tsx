"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/** Returns true only after the component has mounted on the client. */
const subscribe = () => () => {};
function useMounted() {
  // `getSnapshot` returns true on the client and `getServerSnapshot` returns
  // false during SSR, so the first client render matches the server output and
  // subsequent renders can safely read client-only state (the resolved theme).
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}

const OPTIONS = [
  { value: "light", icon: Sun, labelKey: "light" },
  { value: "dark", icon: Moon, labelKey: "dark" },
  { value: "system", icon: Monitor, labelKey: "system" },
] as const;

/**
 * Light / Dark / System segmented control backed by next-themes. Rendering is
 * deferred until mount so the active option (which depends on client-side
 * `theme`) does not cause a hydration mismatch.
 */
export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("settings");
  const mounted = useMounted();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {OPTIONS.map(({ value, icon: Icon, labelKey }) => {
        const isActive = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={isActive}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors outline-none",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-transparent hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="size-4" />
            <span>{t(labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
