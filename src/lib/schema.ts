import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  uuid,
  numeric,
  integer,
  jsonb,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// IMPORTANT! ID fields should ALWAYS use UUID types, EXCEPT the BetterAuth tables.

// ---------------------------------------------------------------------------
// Tenancy: each agency is one isolated tenant (customer of the platform)
// ---------------------------------------------------------------------------

/** A travel agency — the tenant. All business data is scoped to one agency. */
export const agency = pgTable(
  "agency",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // URL-friendly unique handle, e.g. "acme-travel".
    slug: text("slug").notNull().unique(),
    // "active" | "suspended" — a suspended agency's users are locked out.
    status: text("status").default("active").notNull(),
    // --- SaaS billing (vendor → agency). Distinct from traveler `payment`. ---
    // Stripe customer for this agency (the bill payer). NULL until billing setup.
    stripeCustomerId: text("stripe_customer_id"),
    // The agency's active / most-recent subscription id.
    stripeSubscriptionId: text("stripe_subscription_id"),
    // Stripe subscription.status: trialing | active | past_due | canceled |
    // unpaid | incomplete | incomplete_expired | paused. NULL until billing starts.
    subscriptionStatus: text("subscription_status"),
    // The price the agency is subscribed to.
    priceId: text("price_id"),
    // End of the current paid period (renewal/expiry date).
    currentPeriodEnd: timestamp("current_period_end"),
    // Trial expiry, if the agency is on a trial.
    trialEndsAt: timestamp("trial_ends_at"),
    // --- Stripe Connect (traveler → agency payments). The agency's connected
    // Express account that receives client booking payments (destination
    // charges), distinct from the SaaS billing customer above. ---
    // The connected Express account id. NULL until the admin starts onboarding.
    stripeConnectAccountId: text("stripe_connect_account_id"),
    // True once the account finished onboarding and charges are enabled.
    stripeConnectOnboarded: boolean("stripe_connect_onboarded")
      .default(false)
      .notNull(),
    // Timestamp when an admin dismissed the getting-started checklist.
    // NULL = checklist is still active for this agency.
    onboardingDismissedAt: timestamp("onboarding_dismissed_at"),
    // % of a booking total the client must pay for it to reach `confirmed`
    // (the deposit that "secures the dates" on the client proposal). 0–100;
    // 100 means full payment is required to confirm. Defaults to 50%.
    depositPercent: numeric("deposit_percent", { precision: 5, scale: 2 })
      .default("50")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("agency_slug_idx").on(table.slug)]
);

/**
 * A pending invitation to join an agency. Registration is invitation-only:
 * a new user can only sign up if a pending invite matches their email, which
 * stamps their agencyId + role. Created by an agency admin (team invites) or
 * by the platform admin when provisioning a new agency's first admin.
 */
export const agencyInvite = pgTable(
  "agency_invite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agency.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    // Role the invitee receives on acceptance: admin | manager | finance | support | agent.
    role: text("role").default("agent").notNull(),
    // Unguessable token used in the accept link (/invite/[token]).
    token: text("token").notNull().unique(),
    // "pending" | "accepted" | "revoked"
    status: text("status").default("pending").notNull(),
    invitedById: text("invited_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("agency_invite_agency_idx").on(table.agencyId),
    index("agency_invite_email_idx").on(table.email),
    index("agency_invite_token_idx").on(table.token),
  ]
);

// ---------------------------------------------------------------------------
// BetterAuth tables (do NOT change id types — BetterAuth manages these)
// ---------------------------------------------------------------------------

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    // The agency this user belongs to. NULL for the platform super-admin (vendor),
    // who lives above all tenants and is identified by isPlatformAdmin.
    agencyId: uuid("agency_id").references(() => agency.id, {
      onDelete: "cascade",
    }),
    // The platform owner (vendor) who provisions and manages agencies.
    isPlatformAdmin: boolean("is_platform_admin").default(false).notNull(),
    // Application role within the agency: admin | manager | finance | support | agent.
    role: text("role").default("agent").notNull(),
    // Preferred UI locale: "en" | "fr" | "ar" (null falls back to default).
    locale: text("locale"),
    // Soft-disable a team member without deleting their history.
    active: boolean("active").default(true).notNull(),
    // Default commission rate (%) this agent earns from the agency per booking.
    commissionRatePercent: numeric("commission_rate_percent", { precision: 5, scale: 2 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("user_email_idx").on(table.email),
    index("user_agency_idx").on(table.agencyId),
  ]
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("session_user_id_idx").on(table.userId),
    index("session_token_idx").on(table.token),
  ]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    index("account_provider_account_idx").on(table.providerId, table.accountId),
  ]
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

// ---------------------------------------------------------------------------
// CRM: Clients (accounts) and their contacts
// ---------------------------------------------------------------------------

/** A client of the travel agency — an individual traveller or a corporate account. */
export const client = pgTable(
  "client",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agency.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // "individual" | "corporate"
    type: text("type").default("individual").notNull(),
    // "lead" | "active" | "inactive"
    status: text("status").default("active").notNull(),
    email: text("email"),
    phone: text("phone"),
    company: text("company"),
    address: text("address"),
    city: text("city"),
    country: text("country"),
    // How the agency acquired this client (LEAD_SOURCES code).
    source: text("source"),
    // Industry of a corporate client (INDUSTRIES code).
    industry: text("industry"),
    notes: text("notes"),
    // The agent who owns the relationship.
    ownerId: text("owner_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("client_agency_idx").on(table.agencyId),
    index("client_owner_idx").on(table.ownerId),
    index("client_status_idx").on(table.status),
    index("client_name_idx").on(table.name),
    // Composite for tenant-scoped ordering by recency.
    index("client_agency_created_idx").on(table.agencyId, table.createdAt),
  ]
);

/** Additional contacts for a client (useful for corporate accounts). */
export const clientContact = pgTable(
  "client_contact",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    jobTitle: text("job_title"),
    email: text("email"),
    phone: text("phone"),
    isPrimary: boolean("is_primary").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("client_contact_client_idx").on(table.clientId)]
);

// ---------------------------------------------------------------------------
// Opportunities: the sales pipeline
// ---------------------------------------------------------------------------

/** A sales opportunity / deal in the pipeline. */
export const opportunity = pgTable(
  "opportunity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agency.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "cascade" }),
    // "lead" | "qualified" | "proposal" | "booked" | "won" | "lost"
    stage: text("stage").default("lead").notNull(),
    value: numeric("value", { precision: 12, scale: 2 }).default("0").notNull(),
    currency: text("currency").default("EUR").notNull(),
    // 0-100 likelihood of closing.
    probability: integer("probability").default(10).notNull(),
    destination: text("destination"),
    travelStartDate: timestamp("travel_start_date"),
    travelEndDate: timestamp("travel_end_date"),
    paxCount: integer("pax_count").default(1).notNull(),
    // Why the client is travelling (TRAVEL_PURPOSES code).
    travelPurpose: text("travel_purpose"),
    expectedCloseDate: timestamp("expected_close_date"),
    // Reason lost (LOST_REASONS code) — only set when stage = "lost".
    lostReason: text("lost_reason"),
    notes: text("notes"),
    assignedToId: text("assigned_to_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("opportunity_agency_idx").on(table.agencyId),
    index("opportunity_client_idx").on(table.clientId),
    index("opportunity_stage_idx").on(table.stage),
    index("opportunity_assigned_idx").on(table.assignedToId),
    // Composite indexes for tenant-scoped pipeline filter / ordering queries.
    // Opportunity's filterable status column is `stage`.
    index("opportunity_agency_stage_idx").on(table.agencyId, table.stage),
    index("opportunity_agency_created_idx").on(table.agencyId, table.createdAt),
  ]
);

// ---------------------------------------------------------------------------
// Products / Proposals: assembled travel packages quoted to a client
// ---------------------------------------------------------------------------

/** A travel product / proposal assembled from supplier offers and quoted to a client. */
export const product = pgTable(
  "product",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agency.id, { onDelete: "cascade" }),
    // Human-friendly reference, e.g. "PRD-1042". Unique per agency.
    reference: text("reference").notNull(),
    title: text("title").notNull(),
    clientId: uuid("client_id").references(() => client.id, {
      onDelete: "set null",
    }),
    opportunityId: uuid("opportunity_id").references(() => opportunity.id, {
      onDelete: "set null",
    }),
    // "draft" | "sent" | "accepted" | "rejected" | "expired"
    status: text("status").default("draft").notNull(),
    destination: text("destination"),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    paxCount: integer("pax_count").default(1).notNull(),
    currency: text("currency").default("EUR").notNull(),
    // Agency margin applied on top of supplier cost.
    markupPercent: numeric("markup_percent", { precision: 5, scale: 2 })
      .default("0")
      .notNull(),
    // Optional per-deal deposit override for this proposal. NULL means "inherit"
    // — the effective deposit % resolves along the chain
    // booking.depositPercent ?? product.depositPercent (snapshotted at
    // conversion) ?? agency.depositPercent. Nullable & no default so an empty
    // form field saves NULL (inherit), while 0 is a meaningful value (no deposit).
    depositPercent: numeric("deposit_percent", { precision: 5, scale: 2 }),
    totalCost: numeric("total_cost", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    totalPrice: numeric("total_price", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    // Client-facing proposal narrative (often AI-generated).
    summary: text("summary"),
    validUntil: timestamp("valid_until"),
    // --- Public sharing + e-signature acceptance ---
    // Unguessable token for the public, signable proposal link (/p/[token]).
    shareToken: text("share_token").unique(),
    // Set when the client accepts (and signs) or declines via the public link.
    acceptedAt: timestamp("accepted_at"),
    declinedAt: timestamp("declined_at"),
    // Captured at signing for non-repudiation.
    signerName: text("signer_name"),
    signerEmail: text("signer_email"),
    // Typed-name or drawn-signature payload (data URL / plain text).
    signatureData: text("signature_data"),
    signerIp: text("signer_ip"),
    signerUserAgent: text("signer_user_agent"),
    // Set once this proposal has been converted into a booking (idempotency
    // guard for the accept → auto-booking flow). Nullable; onDelete set null so
    // deleting the booking clears the link rather than orphaning the product.
    convertedBookingId: uuid("converted_booking_id").references(
      (): AnyPgColumn => booking.id,
      { onDelete: "set null" }
    ),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("product_agency_idx").on(table.agencyId),
    index("product_client_idx").on(table.clientId),
    index("product_opportunity_idx").on(table.opportunityId),
    index("product_status_idx").on(table.status),
    // Composite indexes for tenant-scoped list + filter / ordering queries.
    index("product_agency_status_idx").on(table.agencyId, table.status),
    index("product_agency_created_idx").on(table.agencyId, table.createdAt),
    // Index the converted-booking FK — used by the accept → auto-booking guard.
    index("product_converted_booking_idx").on(table.convertedBookingId),
    unique("product_agency_reference_unique").on(table.agencyId, table.reference),
  ]
);

/** A single line item within a product (a flight, a hotel night-block, an activity, ...). */
export const productItem = pgTable(
  "product_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    // FK to a managed supplier record (optional — free-text `supplier` kept for ad-hoc entries).
    supplierId: uuid("supplier_id").references(() => supplier.id, {
      onDelete: "set null",
    }),
    // "flight" | "hotel" | "activity" | "transfer" | "insurance" | "other"
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    supplier: text("supplier"),
    quantity: integer("quantity").default(1).notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    currency: text("currency").default("EUR").notNull(),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    // Raw supplier offer payload (flight segments, hotel details, ...).
    details: jsonb("details"),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("product_item_product_idx").on(table.productId),
    // Index the supplier FK — used in supplier/commission joins.
    index("product_item_supplier_idx").on(table.supplierId),
  ]
);

// ---------------------------------------------------------------------------
// Bookings: the simple end-to-end booking file (the main day-to-day flow)
// ---------------------------------------------------------------------------

/** A booking file: one trip sold to a client, with travellers and purchases. */
export const booking = pgTable(
  "booking",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agency.id, { onDelete: "cascade" }),
    reference: text("reference").notNull(), // e.g. "BKG-1042" — unique per agency
    clientId: uuid("client_id").references(() => client.id, {
      onDelete: "set null",
    }),
    // "draft" | "confirmed" | "paid" | "cancelled"
    status: text("status").default("draft").notNull(),
    destination: text("destination"),
    departDate: timestamp("depart_date"),
    returnDate: timestamp("return_date"),
    // Why the client is travelling (TRAVEL_PURPOSES code).
    travelPurpose: text("travel_purpose"),
    // Shape of the journey (TRIP_TYPES code).
    tripType: text("trip_type"),
    currency: text("currency").default("EUR").notNull(),
    notes: text("notes"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    // Snapshotted per-deal deposit override. Set at proposal → booking
    // conversion to the effective deposit % agreed for THIS deal (product
    // override ?? agency default), so later default changes never alter signed
    // terms. NULL means "inherit" — the effective % resolves along the chain
    // booking.depositPercent ?? agency.depositPercent. Nullable & no default so
    // agent-created bookings inherit, while 0 is a meaningful value (no deposit).
    depositPercent: numeric("deposit_percent", { precision: 5, scale: 2 }),
    // Public, unguessable token for the shareable itinerary link (/i/[token]).
    shareToken: text("share_token").unique(),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("booking_agency_idx").on(table.agencyId),
    index("booking_client_idx").on(table.clientId),
    index("booking_status_idx").on(table.status),
    index("booking_depart_idx").on(table.departDate),
    // Composite indexes for tenant-scoped list + filter / ordering queries.
    index("booking_agency_status_idx").on(table.agencyId, table.status),
    index("booking_agency_created_idx").on(table.agencyId, table.createdAt),
    unique("booking_agency_reference_unique").on(table.agencyId, table.reference),
  ]
);

/** A traveller on a booking, with their passport details. */
export const bookingTraveller = pgTable(
  "booking_traveller",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    // Courtesy title (TITLES code) and gender (GENDERS code) — airlines need these.
    title: text("title"),
    gender: text("gender"),
    passportNumber: text("passport_number"),
    passportExpiry: timestamp("passport_expiry"),
    nationality: text("nationality"),
    dateOfBirth: timestamp("date_of_birth"),
    passportIssueDate: timestamp("passport_issue_date"),
    passportIssuePlace: text("passport_issue_place"),
    // Contact details required by supplier APIs (e.g. Duffel requires email + phone on lead).
    email: text("email"),
    phone: text("phone"),
    isLead: boolean("is_lead").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("booking_traveller_booking_idx").on(table.bookingId)]
);

/** A purchased item on a booking: a flight, hotel, excursion, fee, etc. */
export const bookingItem = pgTable(
  "booking_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id, { onDelete: "cascade" }),
    // FK to a managed supplier record (optional — free-text `supplier` kept for ad-hoc entries).
    supplierId: uuid("supplier_id").references(() => supplier.id, {
      onDelete: "set null",
    }),
    // "flight" | "hotel" | "excursion" | "transfer" | "insurance" | "fee" | "other"
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    supplier: text("supplier"),
    // Supplier confirmation / PNR reference.
    bookingRef: text("booking_ref"),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    quantity: integer("quantity").default(1).notNull(),
    // Price charged to the client (per unit).
    amount: numeric("amount", { precision: 12, scale: 2 }).default("0").notNull(),
    // Net supplier cost per unit; null = unknown. Sell price is `amount`. Margin
    // is derived, never stored. No default/notNull on purpose: we never fake a 0
    // cost — directly-created bookings leave this null until an agent fills it in.
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }),
    currency: text("currency").default("EUR").notNull(),
    // Operational status of this line: pending | confirmed | ticketed | cancelled.
    itemStatus: text("item_status").default("pending").notNull(),
    // Supplier confirmation number once booked.
    confirmationNumber: text("confirmation_number"),
    // Itinerary day this item is assigned to (0-based from departure). Null = auto by date.
    dayIndex: integer("day_index"),
    details: jsonb("details"),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("booking_item_booking_idx").on(table.bookingId),
    // Index the supplier FK — used in supplier/commission joins.
    index("booking_item_supplier_idx").on(table.supplierId),
  ]
);

/** A payment (or refund) recorded against a booking. */
export const payment = pgTable(
  "payment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").default("EUR").notNull(),
    // "deposit" | "installment" | "payment" | "refund"
    kind: text("kind").default("payment").notNull(),
    // "manual" | "card" | "transfer" | "cash" | "stripe"
    method: text("method").default("manual").notNull(),
    // "pending" | "completed" | "failed" | "refunded"
    status: text("status").default("completed").notNull(),
    // Stripe id or a manual reference.
    reference: text("reference"),
    // Stripe Checkout Session id (Connect flow), used to reconcile via webhook.
    stripeSessionId: text("stripe_session_id"),
    // The hosted Checkout URL the agent sends to the client.
    checkoutUrl: text("checkout_url"),
    note: text("note"),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("payment_booking_idx").on(table.bookingId),
    // High-volume ledger — index recency for time-ordered reporting.
    index("payment_created_idx").on(table.createdAt),
  ]
);

/** A notification (email/SMS/…) sent about a booking — the communications log. */
export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agency.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id").references(() => booking.id, {
      onDelete: "cascade",
    }),
    // "email" | "sms" | "whatsapp" | "push"
    channel: text("channel").default("email").notNull(),
    recipient: text("recipient").notNull(),
    subject: text("subject"),
    body: text("body"),
    // "confirmation" | "voucher" | "receipt" | "custom" | "invite" | "proposal"
    kind: text("kind").default("custom").notNull(),
    // "sent" | "failed" | "logged"
    status: text("status").default("sent").notNull(),
    error: text("error"),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notification_agency_idx").on(table.agencyId),
    index("notification_booking_idx").on(table.bookingId),
    // Composite for tenant-scoped communications log ordered by recency.
    index("notification_agency_created_idx").on(table.agencyId, table.createdAt),
  ]
);

/**
 * A per-user, in-app notification (the recipient's inbox bell).
 *
 * Distinct from `notification` (the OUTBOUND email/SMS comms log) and from
 * `activity_log` (the manager audit trail): this is the personal inbox a staff
 * member sees in the topbar bell. Rows are best-effort — a failed insert must
 * never break the business action that triggered it.
 */
export const userNotification = pgTable(
  "user_notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Tenant root — every row is scoped to one agency.
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agency.id, { onDelete: "cascade" }),
    // The recipient (a staff user). BetterAuth user ids are text.
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Stable event code callers branch on, never free-text:
    // "proposal_accepted" | "proposal_declined" | "payment_received" | "booking_created"
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    // Internal path to open on click, e.g. "/bookings/{id}". Nullable.
    href: text("href"),
    // Set when the recipient reads the notification. NULL = unread.
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Per-user inbox: unread lookup + list ordering.
    index("user_notification_user_read_idx").on(table.userId, table.readAt),
    // Tenant-scoped recency (housekeeping / tenant deletion cascade support).
    index("user_notification_agency_created_idx").on(
      table.agencyId,
      table.createdAt
    ),
  ]
);

/** Per-day title/notes for a booking's itinerary timeline. */
export const bookingDay = pgTable(
  "booking_day",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id, { onDelete: "cascade" }),
    dayIndex: integer("day_index").notNull(),
    title: text("title"),
    notes: text("notes"),
  },
  (table) => [index("booking_day_booking_idx").on(table.bookingId)]
);

// ---------------------------------------------------------------------------
// Booking lifecycle: supplier references, events, documents, idempotency
// ---------------------------------------------------------------------------

/**
 * Structured supplier-side confirmation for a booking item.
 *
 * Replaces the ad-hoc JSONB in booking_item.details — supplier references must
 * be queryable for status polling, cancellation, and voucher retrieval.
 */
export const bookingSupplierRef = pgTable(
  "booking_supplier_ref",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id, { onDelete: "cascade" }),
    bookingItemId: uuid("booking_item_id")
      .notNull()
      .references(() => bookingItem.id, { onDelete: "cascade" }),
    // Provider that created this confirmation (e.g. "duffel", "hotelbeds", "mock").
    providerId: text("provider_id").notNull(),
    // Supplier confirmation/locator shown to the client.
    confirmationNumber: text("confirmation_number").notNull(),
    // PNR / record locator when available (flights).
    pnr: text("pnr"),
    // Provider's internal order id (e.g. Duffel "order_xxxxx").
    supplierOrderId: text("supplier_order_id"),
    // Full raw response payload — kept for debugging and future re-parsing.
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("booking_supplier_ref_booking_idx").on(table.bookingId),
    index("booking_supplier_ref_item_idx").on(table.bookingItemId),
    index("booking_supplier_ref_provider_idx").on(table.providerId),
  ]
);

/**
 * Immutable event log for each booking — one row per meaningful step.
 *
 * Serves two purposes:
 *   1. Compliance audit trail — every state transition is permanently recorded.
 *   2. Analytics source — booking funnel metrics without a third-party SDK.
 *
 * Events are append-only: never update or delete rows.
 */
export const bookingEvent = pgTable(
  "booking_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id, { onDelete: "cascade" }),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agency.id, { onDelete: "cascade" }),
    // Stable event name — callers branch on this, never on free-text.
    // "search_initiated" | "offer_selected" | "price_validated" | "price_changed"
    // | "booking_submitted" | "booking_confirmed" | "booking_failed"
    // | "booking_cancelled" | "payment_started" | "payment_completed"
    event: text("event").notNull(),
    // Provider that handled this step ("duffel", "hotelbeds", "mock", null for UI events).
    providerId: text("provider_id"),
    // Correlation id for tracing a request across logs.
    correlationId: text("correlation_id"),
    // Structured payload (offer id, price, error code, duration, etc.).
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("booking_event_booking_idx").on(table.bookingId),
    index("booking_event_agency_idx").on(table.agencyId),
    index("booking_event_event_idx").on(table.event),
    index("booking_event_created_idx").on(table.createdAt),
    index("booking_event_booking_created_idx").on(table.bookingId, table.createdAt),
  ]
);

/**
 * Documents generated for a booking: vouchers, e-tickets, invoices, itineraries.
 *
 * `url` stores a Vercel Blob URL when the document is persisted externally.
 * `rawData` stores the supplier's original payload for re-generation.
 */
export const bookingDocument = pgTable(
  "booking_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id, { onDelete: "cascade" }),
    // Optional: document may belong to a specific line item (flight, hotel room).
    bookingItemId: uuid("booking_item_id").references(() => bookingItem.id, {
      onDelete: "set null",
    }),
    // "voucher" | "ticket" | "invoice" | "itinerary" | "receipt"
    type: text("type").notNull(),
    // Provider that issued the document, if applicable.
    providerId: text("provider_id"),
    // Vercel Blob URL or supplier CDN link. Null when document is in rawData only.
    url: text("url"),
    // Supplier's original document payload (base64, JSON, etc.) for re-generation.
    rawData: jsonb("raw_data"),
    generatedAt: timestamp("generated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("booking_document_booking_idx").on(table.bookingId),
    index("booking_document_item_idx").on(table.bookingItemId),
    index("booking_document_type_idx").on(table.type),
  ]
);

/**
 * Idempotency key registry for supplier booking API calls.
 *
 * Prevents duplicate supplier orders on network timeouts, browser re-submission,
 * or server-action re-execution. Key derivation:
 *   sha256(bookingId + bookingItemId + offerId/rateKey)
 *
 * On retry the same key is generated; the stored result is returned without
 * calling the supplier again.
 */
export const bookingIdempotency = pgTable(
  "booking_idempotency",
  {
    // Derived key is the primary key — prevents duplicate rows on replay.
    key: text("key").primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id, { onDelete: "cascade" }),
    bookingItemId: uuid("booking_item_id").references(() => bookingItem.id, {
      onDelete: "cascade",
    }),
    // Provider this key was sent to.
    providerId: text("provider_id").notNull(),
    // "pending" | "success" | "failed"
    status: text("status").default("pending").notNull(),
    // Supplier confirmation reference when the call succeeded.
    supplierRef: text("supplier_ref"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    // Keys are short-lived (24h). Expired rows may be cleaned up by a cron job.
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [
    index("booking_idempotency_booking_idx").on(table.bookingId),
    index("booking_idempotency_expires_idx").on(table.expiresAt),
  ]
);

// ---------------------------------------------------------------------------
// Activity log: audit trail for manager oversight
// ---------------------------------------------------------------------------

/** Records every meaningful action so a manager can see what the team has done. */
export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agency.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    // "created" | "updated" | "deleted" | "stage_changed" | "sent" | "status_changed"
    action: text("action").notNull(),
    // "client" | "opportunity" | "product" | "user"
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    // Human-readable label of the affected entity (kept even if entity is deleted).
    entityLabel: text("entity_label"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("activity_agency_idx").on(table.agencyId),
    index("activity_user_idx").on(table.userId),
    index("activity_entity_idx").on(table.entityType, table.entityId),
    index("activity_created_idx").on(table.createdAt),
  ]
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const agencyRelations = relations(agency, ({ many }) => ({
  users: many(user),
  invites: many(agencyInvite),
  clients: many(client),
  opportunities: many(opportunity),
  products: many(product),
  bookings: many(booking),
  notifications: many(notification),
  userNotifications: many(userNotification),
  activities: many(activityLog),
  suppliers: many(supplier),
  supplierContracts: many(supplierContract),
  commissions: many(commission),
}));

export const agencyInviteRelations = relations(agencyInvite, ({ one }) => ({
  agency: one(agency, {
    fields: [agencyInvite.agencyId],
    references: [agency.id],
  }),
  invitedBy: one(user, {
    fields: [agencyInvite.invitedById],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ one, many }) => ({
  agency: one(agency, {
    fields: [user.agencyId],
    references: [agency.id],
  }),
  ownedClients: many(client, { relationName: "client_owner" }),
  assignedOpportunities: many(opportunity, {
    relationName: "opportunity_assignee",
  }),
  activities: many(activityLog),
  userNotifications: many(userNotification),
}));

export const clientRelations = relations(client, ({ one, many }) => ({
  agency: one(agency, {
    fields: [client.agencyId],
    references: [agency.id],
  }),
  owner: one(user, {
    fields: [client.ownerId],
    references: [user.id],
    relationName: "client_owner",
  }),
  createdBy: one(user, {
    fields: [client.createdById],
    references: [user.id],
  }),
  contacts: many(clientContact),
  opportunities: many(opportunity),
  products: many(product),
  bookings: many(booking),
  portalSessions: many(portalSession),
}));

export const clientContactRelations = relations(clientContact, ({ one }) => ({
  client: one(client, {
    fields: [clientContact.clientId],
    references: [client.id],
  }),
}));

export const opportunityRelations = relations(opportunity, ({ one, many }) => ({
  agency: one(agency, {
    fields: [opportunity.agencyId],
    references: [agency.id],
  }),
  client: one(client, {
    fields: [opportunity.clientId],
    references: [client.id],
  }),
  assignedTo: one(user, {
    fields: [opportunity.assignedToId],
    references: [user.id],
    relationName: "opportunity_assignee",
  }),
  createdBy: one(user, {
    fields: [opportunity.createdById],
    references: [user.id],
  }),
  products: many(product),
}));

export const productRelations = relations(product, ({ one, many }) => ({
  agency: one(agency, {
    fields: [product.agencyId],
    references: [agency.id],
  }),
  client: one(client, {
    fields: [product.clientId],
    references: [client.id],
  }),
  opportunity: one(opportunity, {
    fields: [product.opportunityId],
    references: [opportunity.id],
  }),
  createdBy: one(user, {
    fields: [product.createdById],
    references: [user.id],
  }),
  // The booking this proposal was converted into (set once accepted → booked).
  convertedBooking: one(booking, {
    fields: [product.convertedBookingId],
    references: [booking.id],
  }),
  items: many(productItem),
}));

export const productItemRelations = relations(productItem, ({ one }) => ({
  product: one(product, {
    fields: [productItem.productId],
    references: [product.id],
  }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  agency: one(agency, {
    fields: [activityLog.agencyId],
    references: [agency.id],
  }),
  user: one(user, {
    fields: [activityLog.userId],
    references: [user.id],
  }),
}));

export const bookingRelations = relations(booking, ({ one, many }) => ({
  agency: one(agency, {
    fields: [booking.agencyId],
    references: [agency.id],
  }),
  client: one(client, {
    fields: [booking.clientId],
    references: [client.id],
  }),
  createdBy: one(user, {
    fields: [booking.createdById],
    references: [user.id],
  }),
  travellers: many(bookingTraveller),
  items: many(bookingItem),
  payments: many(payment),
  days: many(bookingDay),
  notifications: many(notification),
  supplierRefs: many(bookingSupplierRef),
  events: many(bookingEvent),
  documents: many(bookingDocument),
}));

export const notificationRelations = relations(notification, ({ one }) => ({
  agency: one(agency, {
    fields: [notification.agencyId],
    references: [agency.id],
  }),
  booking: one(booking, {
    fields: [notification.bookingId],
    references: [booking.id],
  }),
}));

export const userNotificationRelations = relations(
  userNotification,
  ({ one }) => ({
    agency: one(agency, {
      fields: [userNotification.agencyId],
      references: [agency.id],
    }),
    user: one(user, {
      fields: [userNotification.userId],
      references: [user.id],
    }),
  })
);

export const paymentRelations = relations(payment, ({ one }) => ({
  booking: one(booking, {
    fields: [payment.bookingId],
    references: [booking.id],
  }),
}));

export const bookingDayRelations = relations(bookingDay, ({ one }) => ({
  booking: one(booking, {
    fields: [bookingDay.bookingId],
    references: [booking.id],
  }),
}));

export const bookingTravellerRelations = relations(bookingTraveller, ({ one }) => ({
  booking: one(booking, {
    fields: [bookingTraveller.bookingId],
    references: [booking.id],
  }),
}));

export const bookingItemRelations = relations(bookingItem, ({ one, many }) => ({
  booking: one(booking, {
    fields: [bookingItem.bookingId],
    references: [booking.id],
  }),
  supplierRefs: many(bookingSupplierRef),
  documents: many(bookingDocument),
}));

export const bookingSupplierRefRelations = relations(bookingSupplierRef, ({ one }) => ({
  booking: one(booking, {
    fields: [bookingSupplierRef.bookingId],
    references: [booking.id],
  }),
  bookingItem: one(bookingItem, {
    fields: [bookingSupplierRef.bookingItemId],
    references: [bookingItem.id],
  }),
}));

export const bookingEventRelations = relations(bookingEvent, ({ one }) => ({
  booking: one(booking, {
    fields: [bookingEvent.bookingId],
    references: [booking.id],
  }),
  agency: one(agency, {
    fields: [bookingEvent.agencyId],
    references: [agency.id],
  }),
}));

export const bookingDocumentRelations = relations(bookingDocument, ({ one }) => ({
  booking: one(booking, {
    fields: [bookingDocument.bookingId],
    references: [booking.id],
  }),
  bookingItem: one(bookingItem, {
    fields: [bookingDocument.bookingItemId],
    references: [bookingItem.id],
  }),
}));

export const bookingIdempotencyRelations = relations(bookingIdempotency, ({ one }) => ({
  booking: one(booking, {
    fields: [bookingIdempotency.bookingId],
    references: [booking.id],
  }),
  bookingItem: one(bookingItem, {
    fields: [bookingIdempotency.bookingItemId],
    references: [bookingItem.id],
  }),
}));

// ---------------------------------------------------------------------------
// Traveler Portal: client-facing self-service sessions (no BetterAuth)
// ---------------------------------------------------------------------------

/**
 * A passwordless session for a client in the self-service Traveler Portal.
 *
 * Clients authenticate via an email magic link — entirely separate from the
 * BetterAuth (staff) session system. A row starts life as a short-lived magic
 * token (15 min); on verification the token is rotated to a long-lived (7 day)
 * session token stored in an httpOnly cookie. Scoped to one client (and thus
 * one agency, via the client's agencyId).
 */
export const portalSession = pgTable(
  "portal_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    // Discriminates the row's lifecycle stage so a magic token can never be used
    // as a session bearer during its 15-min window:
    //   "magic"   — short-lived (15 min) email magic-link token, single-use.
    //   "session" — long-lived (7 day) session token in the httpOnly cookie.
    // On verification the row is rotated from "magic" → "session". Defaults to
    // "session" so any pre-existing rows keep working as sessions.
    purpose: text("purpose").default("session").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("portal_session_client_idx").on(table.clientId),
    index("portal_session_token_idx").on(table.token),
  ]
);

export const portalSessionRelations = relations(portalSession, ({ one }) => ({
  client: one(client, {
    fields: [portalSession.clientId],
    references: [client.id],
  }),
}));

// ---------------------------------------------------------------------------
// Hotel content cache (global reference data — NOT tenant-scoped)
// ---------------------------------------------------------------------------

/**
 * Cached Hotelbeds Content API data (photos, names, facilities, coordinates).
 *
 * Content rarely changes and the photo CDN URLs are public, so we sync this
 * occasionally (scripts/sync-hotel-content.ts) and serve real hotel photos
 * without spending the live API quota on every search. This is shared vendor
 * reference data, like a currency list — intentionally NOT scoped to an agency.
 * The primary key is the Hotelbeds hotel code (a string), not a UUID.
 */
export const hotelContent = pgTable(
  "hotel_content",
  {
    code: text("code").primaryKey(),
    name: text("name").notNull(),
    stars: integer("stars").default(0).notNull(),
    hotelType: text("hotel_type"),
    description: text("description"),
    address: text("address"),
    city: text("city"),
    country: text("country"),
    postalCode: text("postal_code"),
    latitude: numeric("latitude", { precision: 10, scale: 6 }),
    longitude: numeric("longitude", { precision: 10, scale: 6 }),
    // Hotelbeds destination code (e.g. "BCN") for list-by-destination lookups.
    destinationCode: text("destination_code"),
    // Marketing segment tags, e.g. ["Business hotels"].
    segments: jsonb("segments"),
    // Amenity names present at the property.
    facilities: jsonb("facilities"),
    // All images: { url: string; roomCode?: string }[].
    images: jsonb("images"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("hotel_content_destination_idx").on(table.destinationCode)]
);

// ---------------------------------------------------------------------------
// Supplier management: agency-managed supplier list with contracts and rates
// ---------------------------------------------------------------------------

/** A supplier the agency works with (hotel chain, airline, DMC, car rental, etc.). */
export const supplier = pgTable(
  "supplier",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agency.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // "hotel" | "airline" | "car_rental" | "transfer" | "dmc" | "insurance" | "other"
    type: text("type").notNull(),
    // "active" | "inactive"
    status: text("status").default("active").notNull(),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    address: text("address"),
    city: text("city"),
    country: text("country"),
    contactName: text("contact_name"),
    notes: text("notes"),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("supplier_agency_idx").on(table.agencyId),
    index("supplier_type_idx").on(table.type),
    index("supplier_status_idx").on(table.status),
    unique("supplier_agency_name_unique").on(table.agencyId, table.name),
  ]
);

/** A commercial contract between the agency and a supplier, holding commission rates. */
export const supplierContract = pgTable(
  "supplier_contract",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "cascade" }),
    // Denormalized for efficient agency-scoped queries.
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agency.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    reference: text("reference"),
    // "percent" | "fixed" | "net"
    commissionBasis: text("commission_basis"),
    // Agency's commission rate from this supplier (percentage or fixed amount).
    commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }),
    currency: text("currency").default("EUR").notNull(),
    validFrom: timestamp("valid_from"),
    validTo: timestamp("valid_to"),
    // URL to the uploaded contract PDF (Vercel Blob).
    fileUrl: text("file_url"),
    // "active" | "expired" | "draft"
    status: text("status").default("active").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("supplier_contract_supplier_idx").on(table.supplierId),
    index("supplier_contract_agency_idx").on(table.agencyId),
    index("supplier_contract_status_idx").on(table.status),
  ]
);

/** A structured rate entry within a supplier contract. */
export const supplierRate = pgTable(
  "supplier_rate",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contract_id")
      .notNull()
      .references(() => supplierContract.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    netRate: numeric("net_rate", { precision: 12, scale: 2 }),
    sellRate: numeric("sell_rate", { precision: 12, scale: 2 }),
    currency: text("currency").default("EUR").notNull(),
    validFrom: timestamp("valid_from"),
    validTo: timestamp("valid_to"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("supplier_rate_contract_idx").on(table.contractId)]
);

// ---------------------------------------------------------------------------
// Commissions: agency earns from suppliers, agents earn from agency
// ---------------------------------------------------------------------------

/**
 * Commission ledger row.
 * type="supplier_to_agency" — commission the agency earns from a supplier for a booking item.
 * type="agency_to_agent"   — commission an agent earns from the agency for a booking.
 */
export const commission = pgTable(
  "commission",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agency.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id").references(() => booking.id, {
      onDelete: "set null",
    }),
    // For supplier commissions — the specific booking item this relates to.
    // set null (not cascade): a commission row is a financial ledger entry —
    // earned/paid money history with no soft delete. It must survive the hard
    // deletion of its booking or booking item; we sever the link instead of
    // destroying the record. The agencyId cascade (tenant deletion) still wipes
    // it, which is correct — a deleted tenant takes its whole ledger with it.
    bookingItemId: uuid("booking_item_id").references(() => bookingItem.id, {
      onDelete: "set null",
    }),
    // For supplier commissions — the supplier who pays the commission.
    supplierId: uuid("supplier_id").references(() => supplier.id, {
      onDelete: "set null",
    }),
    // For agent commissions — the agent who earns it.
    agentUserId: text("agent_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    // "supplier_to_agency" | "agency_to_agent"
    type: text("type").notNull(),
    // "percent" | "fixed"
    basis: text("basis").notNull().default("percent"),
    // Rate used (percent when basis=percent).
    rate: numeric("rate", { precision: 5, scale: 2 }),
    // The amount the commission was computed on.
    baseAmount: numeric("base_amount", { precision: 12, scale: 2 }),
    // Computed commission value.
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").default("EUR").notNull(),
    // "pending" | "earned" | "invoiced" | "paid" | "void"
    status: text("status").default("pending").notNull(),
    note: text("note"),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("commission_agency_idx").on(table.agencyId),
    index("commission_booking_idx").on(table.bookingId),
    index("commission_item_idx").on(table.bookingItemId),
    index("commission_supplier_idx").on(table.supplierId),
    index("commission_type_idx").on(table.type),
    index("commission_agent_idx").on(table.agentUserId),
    index("commission_status_idx").on(table.status),
    // Composite indexes for tenant-scoped ledger filter / ordering queries.
    index("commission_agency_status_idx").on(table.agencyId, table.status),
    index("commission_agency_created_idx").on(table.agencyId, table.createdAt),
  ]
);

export const supplierRelations = relations(supplier, ({ one, many }) => ({
  agency: one(agency, {
    fields: [supplier.agencyId],
    references: [agency.id],
  }),
  createdBy: one(user, {
    fields: [supplier.createdById],
    references: [user.id],
  }),
  contracts: many(supplierContract),
  commissions: many(commission),
}));

export const supplierContractRelations = relations(
  supplierContract,
  ({ one, many }) => ({
    supplier: one(supplier, {
      fields: [supplierContract.supplierId],
      references: [supplier.id],
    }),
    agency: one(agency, {
      fields: [supplierContract.agencyId],
      references: [agency.id],
    }),
    rates: many(supplierRate),
  })
);

export const supplierRateRelations = relations(supplierRate, ({ one }) => ({
  contract: one(supplierContract, {
    fields: [supplierRate.contractId],
    references: [supplierContract.id],
  }),
}));

export const commissionRelations = relations(commission, ({ one }) => ({
  agency: one(agency, {
    fields: [commission.agencyId],
    references: [agency.id],
  }),
  booking: one(booking, {
    fields: [commission.bookingId],
    references: [booking.id],
  }),
  bookingItem: one(bookingItem, {
    fields: [commission.bookingItemId],
    references: [bookingItem.id],
  }),
  supplier: one(supplier, {
    fields: [commission.supplierId],
    references: [supplier.id],
  }),
  agent: one(user, {
    fields: [commission.agentUserId],
    references: [user.id],
  }),
  createdBy: one(user, {
    fields: [commission.createdById],
    references: [user.id],
  }),
}));
