"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  LifeBuoy,
  Briefcase,
  Target,
  FileText,
  Users,
  Plane,
  BedDouble,
  Sparkles,
  ShieldCheck,
  CreditCard,
  Compass,
  Truck,
  BadgePercent,
  FileBarChart,
  Menu,
  X,
  LogOut,
  Settings,
  User as UserIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { signOut } from "@/lib/auth-client";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import {
  canManageTeam,
  canViewFinance,
  canViewSupport,
  roleHome,
  type UserRole,
} from "@/lib/domain";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  show?: (role: UserRole) => boolean;
};

type NavSection = {
  /** Translation key for the section label, or null for unlabeled top section. */
  labelKey: string | null;
  items: NavItem[];
  /** Hide the whole section if predicate returns false. */
  show?: (role: UserRole) => boolean;
};

// Navigation follows the golden workflow order:
//   WORK: the daily client/sales/booking flow
//   SOURCING: find and price inventory (flights, hotels, ...)
//   FINANCE: money and reporting (finance-role gated)
//   TOOLS: AI assistant
//   ADMIN: team management, billing (manager/admin gated)
const NAV_SECTIONS: NavSection[] = [
  {
    labelKey: null,
    items: [
      {
        href: "/dashboard",
        labelKey: "dashboard",
        icon: LayoutDashboard,
        show: (r) => roleHome(r) === "/dashboard",
      },
      { href: "/support", labelKey: "support", icon: LifeBuoy, show: canViewSupport },
    ],
  },
  {
    labelKey: "sectionWork",
    items: [
      { href: "/clients",    labelKey: "clients",   icon: Users },
      { href: "/opportunities", labelKey: "pipeline",  icon: Target },
      { href: "/proposals",  labelKey: "proposals", icon: FileText },
      { href: "/bookings",   labelKey: "bookings",  icon: Briefcase },
    ],
  },
  {
    labelKey: "sectionSourcing",
    items: [
      { href: "/sourcing/flights", labelKey: "flights", icon: Plane },
      { href: "/sourcing/hotels",  labelKey: "hotels",  icon: BedDouble },
    ],
  },
  {
    labelKey: "sectionFinance",
    show: canViewFinance,
    items: [
      { href: "/finance",     labelKey: "finance",     icon: Wallet },
      { href: "/commissions", labelKey: "commissions", icon: BadgePercent },
      { href: "/reports",     labelKey: "reports",     icon: FileBarChart },
    ],
  },
  {
    labelKey: "sectionTools",
    items: [
      { href: "/assistant", labelKey: "assistant", icon: Sparkles },
    ],
  },
  {
    labelKey: "sectionAdmin",
    show: canManageTeam,
    items: [
      { href: "/suppliers", labelKey: "suppliers", icon: Truck,       show: canManageTeam },
      { href: "/team",      labelKey: "team",      icon: ShieldCheck, show: canManageTeam },
      { href: "/billing",   labelKey: "billing",   icon: CreditCard,  show: (r) => r === "admin" },
    ],
  },
];

// Flat list of all items — used for "locked" items logic.
const ALL_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export type ShellUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: UserRole;
};

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
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

  // Items the current role cannot access — shown dimmed at the bottom.
  const lockedItems = ALL_ITEMS.filter(
    (i) => i.show && !i.show(user.role)
  );

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <Icon className="size-4 shrink-0" />
        {tNav(item.labelKey)}
      </Link>
    );
  };

  const SidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="border-sidebar-border flex h-16 items-center gap-2 border-b px-5">
        <div className="bg-sidebar-accent flex size-9 items-center justify-center rounded-lg">
          <Compass className="text-sidebar-foreground size-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sidebar-foreground text-base font-bold">{APP_NAME}</p>
          <p className="text-sidebar-foreground/60 text-xs">{APP_TAGLINE}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-4" aria-label="Primary">
        {NAV_SECTIONS.map((section) => {
          // Hide whole section if role predicate fails.
          if (section.show && !section.show(user.role)) return null;

          // Filter items the role can't see.
          const visible = section.items.filter(
            (i) => !i.show || i.show(user.role)
          );
          if (visible.length === 0) return null;

          return (
            <div key={section.labelKey ?? "_top"}>
              {section.labelKey && (
                <p className="text-sidebar-foreground/60 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest">
                  {tNav(section.labelKey)}
                </p>
              )}
              <div className="space-y-0.5">
                {visible.map((item) => renderNavItem(item))}
              </div>
            </div>
          );
        })}

        {/* Locked items — dimmed, role-gated */}
        {lockedItems.length > 0 && (
          <div className="border-sidebar-border border-t pt-3">
            <p className="text-sidebar-foreground/60 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest">
              {tNav("sectionAdmin")}
            </p>
            <div className="space-y-0.5">
              {lockedItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.href}
                    title="Not available for your role"
                    className="text-sidebar-foreground/35 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium cursor-not-allowed select-none"
                  >
                    <Icon className="size-4 shrink-0" />
                    {tNav(item.labelKey)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Settings + User footer */}
      <div className="border-sidebar-border border-t p-3 space-y-1">
        {renderNavItem({ href: "/settings", labelKey: "settings", icon: Settings })}
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <Avatar className="size-8">
            <AvatarImage src={user.image || ""} alt={user.name} />
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-sidebar-foreground truncate text-sm font-medium">{user.name}</p>
            <p className="text-sidebar-foreground/60 truncate text-xs capitalize">
              {user.role}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex-1 justify-start"
          >
            <Link href="/profile" onClick={() => setMobileOpen(false)}>
              <UserIcon className="mr-2 size-4" />
              Profile
            </Link>
          </Button>
          <ModeToggle className="text-sidebar-foreground/75 border-sidebar-border bg-transparent hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:bg-transparent dark:border-sidebar-border dark:hover:bg-sidebar-accent" />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            aria-label={tCommon("signOut")}
            className="text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="bg-sidebar border-sidebar-border hidden w-64 shrink-0 border-r md:block">
        <div className="sticky top-0 h-screen">{SidebarContent}</div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="bg-black/50 absolute inset-0"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="bg-sidebar border-sidebar-border animate-in slide-in-from-left-2 rtl:slide-in-from-right-2 absolute top-0 left-0 h-full w-64 border-r rtl:right-0 rtl:left-auto rtl:border-r-0 rtl:border-l">
            <button
              onClick={() => setMobileOpen(false)}
              className="text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-4 right-3 rounded-md p-1"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
            {SidebarContent}
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center gap-3 border-b px-4 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Compass className="text-primary size-5" />
            <span className="font-bold">{APP_NAME}</span>
          </div>
        </header>

        <main id="main-content" className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
