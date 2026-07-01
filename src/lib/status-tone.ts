/**
 * Semantic status → tone mapping.
 *
 * The app stores stages/statuses as plain snake_case text (see `domain.ts`).
 * Historically each status carried an ad-hoc Tailwind colour string
 * (`bg-green-100 text-green-700`, …) which leaked raw palette values across the
 * UI. This module maps every real status vocabulary to one of the five
 * **semantic tones** backed by the Wave-1 functional tokens:
 *
 *   neutral · success · warning · info · danger
 *
 * Consume it through `<StatusBadge variant={statusTone("booking", status)} />`
 * (or the `<StatusPill>` convenience). The mapping is the single source of
 * truth for status colour — never re-introduce a raw hex/Tailwind colour at the
 * call site.
 *
 * Tone meaning (aligned to the deck's functional palette):
 *   success → terminal-good / settled / active   (green)
 *   warning → needs-attention / in-progress / pending money  (amber)
 *   info    → in-flight / acknowledged / mid-lifecycle  (blue)
 *   danger  → failed / cancelled / lost / overdue  (red)
 *   neutral → draft / inactive / not-yet-started  (grey)
 */

export const STATUS_TONES = [
  "neutral",
  "success",
  "warning",
  "info",
  "danger",
] as const;

export type StatusTone = (typeof STATUS_TONES)[number];

/** The status domains the app knows how to colour. */
export type StatusDomain =
  | "opportunity" // sales pipeline stage
  | "client" // CRM client status
  | "product" // proposal / quote status
  | "booking" // booking lifecycle status
  | "bookingItem" // per-line operational status
  | "paymentRecord" // a single payment row's status
  | "paymentSummary" // derived booking finance status (paid/part/unpaid)
  | "supplier" // supplier active/inactive
  | "contract" // supplier contract status
  | "commission" // commission lifecycle status
  | "subscription" // agency Stripe subscription status
  | "generic"; // shared active/inactive/pending vocabulary

/**
 * Per-domain status → tone tables. Keys are the exact snake_case codes stored
 * in the DB (see `src/lib/domain.ts`). Kept exhaustive per domain so a designer
 * change to a vocabulary surfaces as a missing key rather than a silent grey.
 */
const DOMAIN_TONES: Record<StatusDomain, Record<string, StatusTone>> = {
  // OPPORTUNITY_STAGES
  opportunity: {
    lead: "neutral",
    qualified: "info",
    proposal: "warning",
    booked: "info",
    won: "success",
    lost: "danger",
  },
  // CLIENT_STATUSES
  client: {
    lead: "warning",
    active: "success",
    inactive: "neutral",
  },
  // PRODUCT_STATUSES
  product: {
    draft: "neutral",
    sent: "info",
    accepted: "success",
    rejected: "danger",
    expired: "warning",
  },
  // BOOKING_STATUSES
  booking: {
    draft: "neutral",
    awaiting_payment: "warning",
    confirmed: "info",
    ticketed: "info",
    completed: "success",
    cancelled: "danger",
  },
  // booking item itemStatus (schema: pending | confirmed | ticketed | cancelled)
  bookingItem: {
    pending: "warning",
    confirmed: "info",
    ticketed: "info",
    cancelled: "danger",
  },
  // payment row status (schema: pending | completed | failed | refunded)
  paymentRecord: {
    pending: "warning",
    completed: "success",
    failed: "danger",
    refunded: "neutral",
  },
  // derived booking finance status (see paymentSummary / PaymentSummaryCard)
  paymentSummary: {
    paid_full: "success",
    part_paid: "warning",
    unpaid: "neutral",
    overdue: "danger",
  },
  // SUPPLIER_STATUSES
  supplier: {
    active: "success",
    inactive: "neutral",
  },
  // CONTRACT_STATUSES
  contract: {
    active: "success",
    expired: "warning",
    draft: "neutral",
  },
  // COMMISSION_STATUSES
  commission: {
    pending: "warning",
    earned: "info",
    invoiced: "info",
    paid: "success",
    void: "neutral",
  },
  // agency Stripe subscription status
  subscription: {
    trialing: "info",
    active: "success",
    past_due: "warning",
    unpaid: "danger",
    canceled: "danger",
    cancelled: "danger",
    incomplete: "warning",
    incomplete_expired: "danger",
    paused: "neutral",
  },
  // shared active/inactive/pending/etc. used by generic records
  generic: {
    active: "success",
    inactive: "neutral",
    draft: "neutral",
    pending: "warning",
    completed: "success",
    confirmed: "info",
    cancelled: "danger",
    canceled: "danger",
    failed: "danger",
    expired: "warning",
    paid: "success",
    unpaid: "neutral",
    overdue: "danger",
  },
};

/**
 * Map a `(domain, status)` pair to a semantic tone.
 *
 * Falls back to the `generic` table and finally to `"neutral"` for any code we
 * don't recognise, so callers never crash on an unexpected status. Matching is
 * case-insensitive on the status code.
 *
 * @example
 *   <StatusBadge variant={statusTone("booking", booking.status)} label={label} />
 */
export function statusTone(
  domain: StatusDomain,
  status: string | null | undefined
): StatusTone {
  if (!status) return "neutral";
  const key = status.toLowerCase();
  const table = DOMAIN_TONES[domain];
  return table[key] ?? DOMAIN_TONES.generic[key] ?? "neutral";
}
