/**
 * Domain constants shared across the travel-agency tool.
 * Stages, statuses and types are stored as plain text in the DB; these maps
 * give them labels, ordering and colours for the UI.
 */

import { type StatusTone } from "@/lib/status-tone";

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
  { label: string; description: string }
> = {
  admin: {
    label: "Admin",
    description: "Full access including user & role management",
  },
  manager: {
    label: "Manager",
    description: "Oversees the whole team, bookings and operations",
  },
  finance: {
    label: "Finance",
    description: "Payments, invoices and financials",
  },
  support: {
    label: "Customer Support",
    description: "Client requests and bookings",
  },
  agent: {
    label: "Agent",
    description: "Sells trips and manages their own bookings",
  },
};

/**
 * Roles are *categorical*, not statuses — they don't map cleanly onto the five
 * semantic status tones. This helper picks a sensible on-brand tone per role so
 * role badges stay in the functional-token system instead of raw palette
 * classes. It preserves the intent of the old per-role colours: finance reads
 * as "money/positive" (success), support as "attention" (warning), agents as
 * "neutral", and the elevated admin/manager roles as "info" (Atlas-Blue).
 */
export const USER_ROLE_TONE: Record<UserRole, StatusTone> = {
  admin: "info",
  manager: "info",
  finance: "success",
  support: "warning",
  agent: "neutral",
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
  { label: string; description: string; defaultProbability: number }
> = {
  lead: {
    label: "Lead",
    description: "New enquiry, not yet qualified",
    defaultProbability: 10,
  },
  qualified: {
    label: "Qualified",
    description: "Budget & dates confirmed",
    defaultProbability: 30,
  },
  proposal: {
    label: "Proposal sent",
    description: "Quote delivered to the client",
    defaultProbability: 60,
  },
  booked: {
    label: "Booked",
    description: "Client accepted, booking in progress",
    defaultProbability: 90,
  },
  won: {
    label: "Won",
    description: "Trip confirmed & paid",
    defaultProbability: 100,
  },
  lost: {
    label: "Lost",
    description: "Did not convert",
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

export const CLIENT_STATUS_META: Record<ClientStatus, { label: string }> = {
  lead: { label: "Lead" },
  active: { label: "Active" },
  inactive: { label: "Inactive" },
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

export const PRODUCT_STATUS_META: Record<ProductStatus, { label: string }> = {
  draft: { label: "Draft" },
  sent: { label: "Sent" },
  accepted: { label: "Accepted" },
  rejected: { label: "Rejected" },
  expired: { label: "Expired" },
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

export const BOOKING_STATUS_META: Record<BookingStatus, { label: string }> = {
  draft: { label: "Draft" },
  awaiting_payment: { label: "Awaiting payment" },
  confirmed: { label: "Confirmed" },
  ticketed: { label: "Ticketed" },
  completed: { label: "Completed" },
  cancelled: { label: "Cancelled" },
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

// --- Controlled vocabularies (Phase 2) --------------------------------------
// Stored as snake_case codes in the DB; the UI shows the friendly label. Keep
// codes stable for reporting — only ever append new values, never rename.

const labelMap = <T extends string>(labels: Record<T, string>): Record<T, string> =>
  labels;

/** How a client first reached the agency. */
export const LEAD_SOURCES = [
  "referral", "website", "instagram", "facebook", "walk_in",
  "partner", "event", "outbound", "repeat", "other",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const LEAD_SOURCE_LABEL = labelMap<LeadSource>({
  referral: "Referral",
  website: "Website",
  instagram: "Instagram",
  facebook: "Facebook",
  walk_in: "Walk-in",
  partner: "Partner",
  event: "Event",
  outbound: "Outbound",
  repeat: "Repeat client",
  other: "Other",
});

/** Why the client is travelling — drives segmentation & reporting. */
export const TRAVEL_PURPOSES = [
  "leisure", "business", "honeymoon", "family", "group",
  "umrah", "hajj", "medical", "education", "other",
] as const;
export type TravelPurpose = (typeof TRAVEL_PURPOSES)[number];
export const TRAVEL_PURPOSE_LABEL = labelMap<TravelPurpose>({
  leisure: "Leisure",
  business: "Business",
  honeymoon: "Honeymoon",
  family: "Family",
  group: "Group",
  umrah: "Umrah",
  hajj: "Hajj",
  medical: "Medical",
  education: "Education",
  other: "Other",
});

/** Shape of the journey. */
export const TRIP_TYPES = ["one_way", "round_trip", "multi_city"] as const;
export type TripType = (typeof TRIP_TYPES)[number];
export const TRIP_TYPE_LABEL = labelMap<TripType>({
  one_way: "One-way",
  round_trip: "Round-trip",
  multi_city: "Multi-city",
});

/** Traveller gender (airlines require this on tickets). */
export const GENDERS = ["male", "female", "unspecified"] as const;
export type Gender = (typeof GENDERS)[number];
export const GENDER_LABEL = labelMap<Gender>({
  male: "Male",
  female: "Female",
  unspecified: "Unspecified",
});

/** Traveller courtesy title. */
export const TITLES = ["mr", "mrs", "ms", "dr", "prof"] as const;
export type Title = (typeof TITLES)[number];
export const TITLE_LABEL = labelMap<Title>({
  mr: "Mr",
  mrs: "Mrs",
  ms: "Ms",
  dr: "Dr",
  prof: "Prof",
});

/** Why an opportunity was lost — for win/loss analysis. */
export const LOST_REASONS = [
  "price", "timing", "competitor", "no_response", "postponed", "budget", "other",
] as const;
export type LostReason = (typeof LOST_REASONS)[number];
export const LOST_REASON_LABEL = labelMap<LostReason>({
  price: "Price",
  timing: "Timing",
  competitor: "Chose a competitor",
  no_response: "No response",
  postponed: "Trip postponed",
  budget: "Budget",
  other: "Other",
});

/** Industry of a corporate client. */
export const INDUSTRIES = [
  "tourism", "energy", "technology", "finance", "retail", "construction",
  "public_sector", "health", "education", "telecom", "logistics", "other",
] as const;
export type Industry = (typeof INDUSTRIES)[number];
export const INDUSTRY_LABEL = labelMap<Industry>({
  tourism: "Tourism & Hospitality",
  energy: "Energy",
  technology: "Technology",
  finance: "Finance & Banking",
  retail: "Retail",
  construction: "Construction",
  public_sector: "Public Sector",
  health: "Health",
  education: "Education",
  telecom: "Telecom",
  logistics: "Logistics",
  other: "Other",
});

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

export const SUPPLIER_STATUS_META: Record<SupplierStatus, { label: string }> = {
  active: { label: "Active" },
  inactive: { label: "Inactive" },
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

export const CONTRACT_STATUS_META: Record<ContractStatus, { label: string }> = {
  active: { label: "Active" },
  expired: { label: "Expired" },
  draft: { label: "Draft" },
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

export const COMMISSION_STATUS_META: Record<CommissionStatus, { label: string }> = {
  pending:  { label: "Pending" },
  earned:   { label: "Earned" },
  invoiced: { label: "Invoiced" },
  paid:     { label: "Paid" },
  void:     { label: "Void" },
};
