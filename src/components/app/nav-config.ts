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
  Truck,
  BadgePercent,
  FileBarChart,
} from "lucide-react";
import {
  canManageTeam,
  canViewFinance,
  canViewSupport,
  roleHome,
  type UserRole,
} from "@/lib/domain";

/** A count badge key the shell/layout can populate with real data. */
export type NavBadgeKey = "proposals" | "bookings";

export type NavItem = {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  show?: (role: UserRole) => boolean;
  /** When set, the shell renders a live count badge sourced from real data. */
  badge?: NavBadgeKey;
};

export type NavSection = {
  /** Translation key for the section label, or null for the unlabeled top section. */
  labelKey: string | null;
  items: NavItem[];
  /** Hide the whole section if the predicate returns false. */
  show?: (role: UserRole) => boolean;
};

// Navigation follows the golden workflow order:
//   WORK: the daily client/sales/booking flow
//   SOURCING: find and price inventory (flights, hotels, ...)
//   FINANCE: money and reporting (finance-role gated)
//   TOOLS: AI assistant
//   ADMIN: team management, billing (manager/admin gated)
export const NAV_SECTIONS: NavSection[] = [
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
      { href: "/clients", labelKey: "clients", icon: Users },
      { href: "/opportunities", labelKey: "pipeline", icon: Target },
      { href: "/proposals", labelKey: "proposals", icon: FileText, badge: "proposals" },
      { href: "/bookings", labelKey: "bookings", icon: Briefcase, badge: "bookings" },
    ],
  },
  {
    labelKey: "sectionSourcing",
    items: [
      { href: "/sourcing/flights", labelKey: "flights", icon: Plane },
      { href: "/sourcing/hotels", labelKey: "hotels", icon: BedDouble },
    ],
  },
  {
    labelKey: "sectionFinance",
    show: canViewFinance,
    items: [
      { href: "/finance", labelKey: "finance", icon: Wallet },
      { href: "/commissions", labelKey: "commissions", icon: BadgePercent },
      { href: "/reports", labelKey: "reports", icon: FileBarChart },
    ],
  },
  {
    labelKey: "sectionTools",
    items: [{ href: "/assistant", labelKey: "assistant", icon: Sparkles }],
  },
  {
    labelKey: "sectionAdmin",
    show: canManageTeam,
    items: [
      { href: "/suppliers", labelKey: "suppliers", icon: Truck, show: canManageTeam },
      { href: "/team", labelKey: "team", icon: ShieldCheck, show: canManageTeam },
      { href: "/billing", labelKey: "billing", icon: CreditCard, show: (r) => r === "admin" },
    ],
  },
];

/** Live count badges the shell can render on nav items. */
export type NavCounts = Partial<Record<NavBadgeKey, number>>;

/** Flat list of all items — used for "locked" (role-gated) items logic. */
export const ALL_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

/** Sections visible to a role, with items the role can't access filtered out. */
export function visibleSections(role: UserRole): NavSection[] {
  return NAV_SECTIONS.map((section) => {
    if (section.show && !section.show(role)) return null;
    const items = section.items.filter((i) => !i.show || i.show(role));
    if (items.length === 0) return null;
    return { ...section, items };
  }).filter((s): s is NavSection => s !== null);
}
