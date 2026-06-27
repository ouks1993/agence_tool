/**
 * Domain constants shared across the travel-agency tool.
 * Stages, statuses and types are stored as plain text in the DB; these maps
 * give them labels, ordering and colours for the UI.
 */

export const USER_ROLES = [
  "admin",
  "manager",
  "finance",
  "support",
  "agent",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_META: Record<
  UserRole,
  { label: string; description: string; badgeClass: string }
> = {
  admin: {
    label: "Admin",
    description: "Full access including user & role management",
    badgeClass: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  manager: {
    label: "Manager",
    description: "Oversees the whole team, bookings and operations",
    badgeClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  finance: {
    label: "Finance",
    description: "Payments, invoices and financials",
    badgeClass: "bg-green-500/15 text-green-600 dark:text-green-400",
  },
  support: {
    label: "Customer Support",
    description: "Client requests and bookings",
    badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  agent: {
    label: "Agent",
    description: "Sells trips and manages their own bookings",
    badgeClass: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  },
};

// --- Capabilities (simple role-based access control) ------------------------

/** Roles that see the whole agency's data. Agents only see their own work. */
export const FULL_VISIBILITY_ROLES: UserRole[] = [
  "admin",
  "manager",
  "finance",
  "support",
];
export function seesAllData(role: UserRole): boolean {
  return FULL_VISIBILITY_ROLES.includes(role);
}
export function canManageTeam(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}
/** Only an admin can grant or change the admin role (prevents escalation). */
export function canAssignAdmin(role: UserRole): boolean {
  return role === "admin";
}
export function canManagePayments(role: UserRole): boolean {
  return role === "admin" || role === "manager" || role === "finance";
}
export function canViewFinance(role: UserRole): boolean {
  return canManagePayments(role);
}
export function canDeleteRecords(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}
/** Roles that can use the Support workspace (client requests & bookings). */
export function canViewSupport(role: UserRole): boolean {
  return role === "admin" || role === "manager" || role === "support";
}

/**
 * The default landing page for each role — where they go after login. Finance
 * and Support get their own workspaces; everyone else uses the dashboard
 * (which itself adapts: managers/admins see agency-wide, agents see their own).
 */
export function roleHome(role: UserRole): string {
  switch (role) {
    case "finance":
      return "/finance";
    case "support":
      return "/support";
    default:
      return "/dashboard";
  }
}

// --- Opportunities (sales pipeline) ----------------------------------------

export const OPPORTUNITY_STAGES = [
  "lead",
  "qualified",
  "proposal",
  "booked",
  "won",
  "lost",
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const OPPORTUNITY_STAGE_META: Record<
  OpportunityStage,
  { label: string; description: string; badgeClass: string; defaultProbability: number }
> = {
  lead: {
    label: "Lead",
    description: "New enquiry, not yet qualified",
    badgeClass: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
    defaultProbability: 10,
  },
  qualified: {
    label: "Qualified",
    description: "Budget & dates confirmed",
    badgeClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    defaultProbability: 30,
  },
  proposal: {
    label: "Proposal sent",
    description: "Quote delivered to the client",
    badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    defaultProbability: 60,
  },
  booked: {
    label: "Booked",
    description: "Client accepted, booking in progress",
    badgeClass: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    defaultProbability: 90,
  },
  won: {
    label: "Won",
    description: "Trip confirmed & paid",
    badgeClass: "bg-green-500/15 text-green-600 dark:text-green-400",
    defaultProbability: 100,
  },
  lost: {
    label: "Lost",
    description: "Did not convert",
    badgeClass: "bg-red-500/15 text-red-600 dark:text-red-400",
    defaultProbability: 0,
  },
};

/** Stages that count as still being in the active pipeline. */
export const OPEN_STAGES: OpportunityStage[] = [
  "lead",
  "qualified",
  "proposal",
  "booked",
];

// --- Clients ----------------------------------------------------------------

export const CLIENT_TYPES = ["individual", "corporate"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const CLIENT_STATUSES = ["lead", "active", "inactive"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CLIENT_STATUS_META: Record<
  ClientStatus,
  { label: string; badgeClass: string }
> = {
  lead: { label: "Lead", badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  active: { label: "Active", badgeClass: "bg-green-500/15 text-green-600 dark:text-green-400" },
  inactive: { label: "Inactive", badgeClass: "bg-slate-500/15 text-slate-600 dark:text-slate-300" },
};

// --- Products / proposals ---------------------------------------------------

export const PRODUCT_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_STATUS_META: Record<
  ProductStatus,
  { label: string; badgeClass: string }
> = {
  draft: { label: "Draft", badgeClass: "bg-slate-500/15 text-slate-600 dark:text-slate-300" },
  sent: { label: "Sent", badgeClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  accepted: { label: "Accepted", badgeClass: "bg-green-500/15 text-green-600 dark:text-green-400" },
  rejected: { label: "Rejected", badgeClass: "bg-red-500/15 text-red-600 dark:text-red-400" },
  expired: { label: "Expired", badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
};

export const PRODUCT_ITEM_TYPES = [
  "flight",
  "hotel",
  "activity",
  "transfer",
  "insurance",
  "other",
] as const;
export type ProductItemType = (typeof PRODUCT_ITEM_TYPES)[number];

export const PRODUCT_ITEM_TYPE_META: Record<
  ProductItemType,
  { label: string; icon: string }
> = {
  flight: { label: "Flight", icon: "Plane" },
  hotel: { label: "Hotel", icon: "BedDouble" },
  activity: { label: "Activity", icon: "Ticket" },
  transfer: { label: "Transfer", icon: "Car" },
  insurance: { label: "Insurance", icon: "ShieldCheck" },
  other: { label: "Other", icon: "Package" },
};

// --- Bookings ---------------------------------------------------------------

export const BOOKING_STATUSES = [
  "draft",
  "awaiting_payment",
  "confirmed",
  "ticketed",
  "completed",
  "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_META: Record<
  BookingStatus,
  { label: string; badgeClass: string }
> = {
  draft: { label: "Draft", badgeClass: "bg-slate-500/15 text-slate-600 dark:text-slate-300" },
  awaiting_payment: {
    label: "Awaiting payment",
    badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  confirmed: { label: "Confirmed", badgeClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  ticketed: { label: "Ticketed", badgeClass: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  completed: { label: "Completed", badgeClass: "bg-green-500/15 text-green-600 dark:text-green-400" },
  cancelled: { label: "Cancelled", badgeClass: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

/** Ordered operational lifecycle (excludes cancelled). */
export const BOOKING_LIFECYCLE: BookingStatus[] = [
  "draft",
  "awaiting_payment",
  "confirmed",
  "ticketed",
  "completed",
];

/** The next status in the lifecycle, or null if at the end / cancelled. */
export function nextBookingStatus(status: string): BookingStatus | null {
  const i = BOOKING_LIFECYCLE.indexOf(status as BookingStatus);
  if (i === -1 || i >= BOOKING_LIFECYCLE.length - 1) return null;
  return BOOKING_LIFECYCLE[i + 1]!;
}

// Payments
export const PAYMENT_KINDS = ["deposit", "installment", "payment", "refund"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];
export const PAYMENT_METHODS = ["manual", "card", "transfer", "cash", "stripe"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_KIND_LABEL: Record<PaymentKind, string> = {
  deposit: "Deposit",
  installment: "Installment",
  payment: "Payment",
  refund: "Refund",
};

export const BOOKING_ITEM_TYPES = [
  "flight",
  "hotel",
  "transfer",
  "excursion",
  "insurance",
  "fee",
  "other",
] as const;
export type BookingItemType = (typeof BOOKING_ITEM_TYPES)[number];

export const BOOKING_ITEM_TYPE_META: Record<
  BookingItemType,
  { label: string; icon: string; group: "travel" | "extra" }
> = {
  flight: { label: "Flight", icon: "Plane", group: "travel" },
  hotel: { label: "Hotel", icon: "BedDouble", group: "travel" },
  transfer: { label: "Transfer", icon: "Car", group: "travel" },
  excursion: { label: "Excursion", icon: "Ticket", group: "extra" },
  insurance: { label: "Insurance", icon: "ShieldCheck", group: "extra" },
  fee: { label: "Fee", icon: "Receipt", group: "extra" },
  other: { label: "Other", icon: "Package", group: "extra" },
};

/** Item types that are "the trip" vs "extras & fees". */
export const TRAVEL_ITEM_TYPES: BookingItemType[] = ["flight", "hotel", "transfer"];
export const EXTRA_ITEM_TYPES: BookingItemType[] = [
  "excursion",
  "insurance",
  "fee",
  "other",
];

// --- Currencies -------------------------------------------------------------

export const SUPPORTED_CURRENCIES = ["DZD", "EUR", "USD"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = "DZD";

// --- Suppliers --------------------------------------------------------------

export const SUPPLIER_TYPES = [
  "hotel",
  "airline",
  "car_rental",
  "transfer",
  "dmc",
  "insurance",
  "other",
] as const;
export type SupplierType = (typeof SUPPLIER_TYPES)[number];

export const SUPPLIER_TYPE_META: Record<
  SupplierType,
  { label: string; icon: string }
> = {
  hotel: { label: "Hotel", icon: "BedDouble" },
  airline: { label: "Airline", icon: "Plane" },
  car_rental: { label: "Car Rental", icon: "Car" },
  transfer: { label: "Transfer", icon: "Bus" },
  dmc: { label: "DMC", icon: "Globe" },
  insurance: { label: "Insurance", icon: "ShieldCheck" },
  other: { label: "Other", icon: "Package" },
};

export const SUPPLIER_STATUSES = ["active", "inactive"] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export const SUPPLIER_STATUS_META: Record<
  SupplierStatus,
  { label: string; className: string }
> = {
  active: { label: "Active", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  inactive: { label: "Inactive", className: "bg-muted text-muted-foreground" },
};

export const CONTRACT_BASES = ["percent", "fixed", "net"] as const;
export type ContractBasis = (typeof CONTRACT_BASES)[number];

export const CONTRACT_BASIS_LABEL: Record<ContractBasis, string> = {
  percent: "Percentage",
  fixed: "Fixed amount",
  net: "Net rate",
};

export const CONTRACT_STATUSES = ["active", "expired", "draft"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_STATUS_META: Record<
  ContractStatus,
  { label: string; className: string }
> = {
  active: { label: "Active", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  expired: { label: "Expired", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
};

// --- Commissions ------------------------------------------------------------

export const COMMISSION_TYPES = ["supplier_to_agency", "agency_to_agent"] as const;
export type CommissionType = (typeof COMMISSION_TYPES)[number];

export const COMMISSION_TYPE_LABEL: Record<CommissionType, string> = {
  supplier_to_agency: "Supplier → Agency",
  agency_to_agent: "Agency → Agent",
};

export const COMMISSION_BASES = ["percent", "fixed"] as const;
export type CommissionBasis = (typeof COMMISSION_BASES)[number];

export const COMMISSION_STATUSES = ["pending", "earned", "invoiced", "paid", "void"] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

export const COMMISSION_STATUS_META: Record<
  CommissionStatus,
  { label: string; className: string }
> = {
  pending:  { label: "Pending",  className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  earned:   { label: "Earned",   className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  invoiced: { label: "Invoiced", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  paid:     { label: "Paid",     className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  void:     { label: "Void",     className: "bg-muted text-muted-foreground" },
};
