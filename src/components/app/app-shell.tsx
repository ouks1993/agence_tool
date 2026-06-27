"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  LifeBuoy,
  Briefcase,
  ClipboardList,
  Users,
  Search,
  BedDouble,
  Sparkles,
  ShieldCheck,
  CreditCard,
  Compass,
  Truck,
  BadgePercent,
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
  /** Key into the `nav` translation namespace. */
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  /** When set, the item is only rendered if the predicate passes for the role. */
  show?: (role: UserRole) => boolean;
};

const NAV: NavItem[] = [
  // Dashboard is the home for roles that don't have a dedicated workspace
  // (admin, manager, agent); finance/support land on their own pages instead.
  {
    href: "/dashboard",
    labelKey: "dashboard",
    icon: LayoutDashboard,
    show: (r) => roleHome(r) === "/dashboard",
  },
  { href: "/finance", labelKey: "finance", icon: Wallet, show: canViewFinance },
  { href: "/commissions", labelKey: "commissions", icon: BadgePercent, show: canViewFinance },
  { href: "/support", labelKey: "support", icon: LifeBuoy, show: canViewSupport },
  { href: "/bookings", labelKey: "bookings", icon: Briefcase },
  { href: "/operations", labelKey: "operations", icon: ClipboardList },
  { href: "/clients", labelKey: "clients", icon: Users },
  { href: "/search", labelKey: "search", icon: Search },
  { href: "/hotels", labelKey: "hotels", icon: BedDouble },
  { href: "/assistant", labelKey: "assistant", icon: Sparkles },
  { href: "/suppliers", labelKey: "suppliers", icon: Truck, show: canManageTeam },
  { href: "/team", labelKey: "team", icon: ShieldCheck, show: canManageTeam },
  // Billing is admin-only (manages the agency's SaaS subscription).
  { href: "/billing", labelKey: "billing", icon: CreditCard, show: (r) => r === "admin" },
  // Settings is available to every role.
  { href: "/settings", labelKey: "settings", icon: Settings },
];

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

  const items = NAV.filter((i) => !i.show || i.show(user.role));

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
    router.refresh();
  };

  const SidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <div className="bg-primary/10 flex size-9 items-center justify-center rounded-lg">
          <Compass className="text-primary size-5" />
        </div>
        <div className="leading-tight">
          <p className="text-base font-bold">{APP_NAME}</p>
          <p className="text-muted-foreground text-xs">{APP_TAGLINE}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Primary">
        {items.map((item) => {
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
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {tNav(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <Avatar className="size-8">
            <AvatarImage src={user.image || ""} alt={user.name} />
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="text-muted-foreground truncate text-xs capitalize">
              {user.role}
            </p>
          </div>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="flex-1 justify-start"
          >
            <Link href="/profile" onClick={() => setMobileOpen(false)}>
              <UserIcon className="mr-2 size-4" />
              Profile
            </Link>
          </Button>
          <ModeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            aria-label={tCommon("signOut")}
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
      <aside className="bg-sidebar hidden w-64 shrink-0 border-r md:block">
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
          <div className="bg-sidebar animate-in slide-in-from-left-2 absolute top-0 left-0 h-full w-64 border-r">
            <button
              onClick={() => setMobileOpen(false)}
              className="hover:bg-accent absolute top-4 right-3 rounded-md p-1"
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
