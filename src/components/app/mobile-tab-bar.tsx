"use client";

import Link from "next/link";
import { Briefcase, LayoutDashboard, Sparkles, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { roleHome, type UserRole } from "@/lib/domain";
import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  show?: (role: UserRole) => boolean;
};

// The 4 primary thumb-reachable destinations (per mobile.html .pf-tabbar).
const TABS: Tab[] = [
  {
    href: "/dashboard",
    labelKey: "dashboard",
    icon: LayoutDashboard,
    show: (r) => roleHome(r) === "/dashboard",
  },
  { href: "/clients", labelKey: "clients", icon: Users },
  { href: "/bookings", labelKey: "bookings", icon: Briefcase },
  { href: "/assistant", labelKey: "assistant", icon: Sparkles },
];

/**
 * Fixed bottom tab bar for phones (below md). Mirrors mobile.html .pf-tabbar:
 * 4 primary destinations, 21px icons over 9.5–10px labels, active in --brand.
 */
export function MobileTabBar({
  role,
  isActive,
}: {
  role: UserRole;
  isActive: (href: string) => boolean;
}) {
  const tNav = useTranslations("nav");
  const tabs = TABS.filter((t) => !t.show || t.show(role));

  return (
    <nav
      aria-label="Primary"
      className="bg-background/92 border-border fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 backdrop-blur-md backdrop-saturate-150 md:hidden"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] font-medium transition-colors",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-[21px]" />
            {tNav(tab.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
