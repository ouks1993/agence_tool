"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Settings as SettingsIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CommandPalette,
  type PaletteEntities,
} from "@/components/app/command-palette";
import { MobileTabBar } from "@/components/app/mobile-tab-bar";
import {
  visibleSections,
  type NavCounts,
  type NavItem,
} from "@/components/app/nav-config";
import { Topbar } from "@/components/app/topbar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { signOut } from "@/lib/auth-client";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { type UserRole } from "@/lib/domain";
import { cn } from "@/lib/utils";

export type ShellUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: UserRole;
};

export function AppShell({
  user,
  counts,
  paletteEntities,
  children,
}: {
  user: ShellUser;
  /** Live nav count badges (real data only — omit keys that aren't cheaply available). */
  counts?: NavCounts;
  /** Entities the command palette can jump to (real data from queries). */
  paletteEntities?: PaletteEntities;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  // Map canonical nav URLs to the underlying page paths served via rewrites
  // so the active highlight stays correct even while the rewrite is in effect.
  const REWRITE_ALIASES: Record<string, string> = {
    "/proposals": "/products",
    "/sourcing/hotels": "/hotels",
  };

  const isActive = (href: string) => {
    if (pathname === href || pathname.startsWith(`${href}/`)) return true;
    const alias = REWRITE_ALIASES[href];
    if (alias && (pathname === alias || pathname.startsWith(`${alias}/`))) return true;
    return false;
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
    router.refresh();
  };

  // Sections/items the current role cannot access are hidden entirely
  // (no dimmed "teaser" list — see audit findings).
  const sections = visibleSections(user.role);

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    const count = item.badge ? counts?.[item.badge] : undefined;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground before:bg-sidebar-primary before:absolute before:top-1/2 before:left-0 before:h-[18px] before:w-[3px] before:-translate-x-3.5 before:-translate-y-1/2 before:rounded-r-full before:content-[''] rtl:before:right-0 rtl:before:left-auto rtl:before:translate-x-3.5 rtl:before:rounded-l-full rtl:before:rounded-r-none"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <Icon className="size-[17px] shrink-0" />
        <span className="min-w-0 flex-1 truncate">{tNav(item.labelKey)}</span>
        {count !== undefined && count > 0 && (
          <span className="bg-sidebar-accent text-sidebar-foreground ms-auto rounded-full px-1.5 py-px text-[10.5px] font-semibold tabular-nums">
            {count}
          </span>
        )}
      </Link>
    );
  };

  const SidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand — gradient logo mark per deck */}
      <div className="border-sidebar-border flex h-[60px] items-center gap-2.5 border-b px-4">
        <div className="from-primary to-[#3E72E0] flex size-8 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
          <span className="text-[15px] font-extrabold leading-none">A</span>
        </div>
        <div className="leading-tight">
          <p className="text-sidebar-foreground text-base font-bold">{APP_NAME}</p>
          <p className="text-sidebar-foreground/60 text-xs">{APP_TAGLINE}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-4" aria-label="Primary">
        {sections.map((section) => (
          <div key={section.labelKey ?? "_top"}>
            {section.labelKey && (
              <p className="text-sidebar-foreground/60 mb-1.5 px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]">
                {tNav(section.labelKey)}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => renderNavItem(item))}
            </div>
          </div>
        ))}
      </nav>

      {/* Settings footer */}
      <div className="border-sidebar-border border-t px-3.5 py-3">
        {renderNavItem({ href: "/settings", labelKey: "settings", icon: SettingsIcon })}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Skip to content — first focusable element */}
      <a href="#main-content" className="skip-link">
        {tCommon("skipToContent")}
      </a>

      {/* Desktop sidebar */}
      <aside className="bg-sidebar border-sidebar-border hidden w-60 shrink-0 border-r md:block rtl:border-r-0 rtl:border-l">
        <div className="sticky top-0 h-screen">{SidebarContent}</div>
      </aside>

      {/* Mobile drawer — Sheet (focus trap, Esc, scroll-lock) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="bg-sidebar border-sidebar-border w-64 gap-0 p-0 [&>button]:text-sidebar-foreground/75 [&>button:hover]:text-sidebar-foreground"
        >
          <SheetTitle className="sr-only">{APP_NAME}</SheetTitle>
          {SidebarContent}
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop topbar */}
        <Topbar user={user} onSignOut={handleSignOut} />

        {/* Mobile top bar — dark brand strip */}
        <header className="bg-sidebar border-sidebar-border sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-3 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground size-11"
          >
            <Menu className="size-5" />
          </Button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="from-primary to-[#3E72E0] flex size-7 items-center justify-center rounded-md bg-gradient-to-br text-[13px] font-extrabold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
              A
            </span>
            <span className="text-sidebar-foreground font-bold">{APP_NAME}</span>
          </Link>
        </header>

        <main id="main-content" className="flex-1 pb-16 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <MobileTabBar role={user.role} isActive={isActive} />

      {/* Command palette (⌘K) */}
      <CommandPalette role={user.role} entities={paletteEntities} />
    </div>
  );
}
