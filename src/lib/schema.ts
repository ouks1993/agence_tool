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
    // Soft-disable a team member without deleting their history.
    active: boolean("active").default(true).notNull(),
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

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

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
    // How the agency acquired this client (referral, website, walk-in, ...).
    source: text("source"),
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
    expectedCloseDate: timestamp("expected_close_date"),
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
    totalCost: numeric("total_cost", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    totalPrice: numeric("total_price", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    // Client-facing proposal narrative (often AI-generated).
    summary: text("summary"),
    validUntil: timestamp("valid_until"),
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
  (table) => [index("product_item_product_idx").on(table.productId)]
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
    currency: text("currency").default("EUR").notNull(),
    notes: text("notes"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
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
    passportNumber: text("passport_number"),
    passportExpiry: timestamp("passport_expiry"),
    nationality: text("nationality"),
    dateOfBirth: timestamp("date_of_birth"),
    passportIssueDate: timestamp("passport_issue_date"),
    passportIssuePlace: text("passport_issue_place"),
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
  (table) => [index("booking_item_booking_idx").on(table.bookingId)]
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
    note: text("note"),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("payment_booking_idx").on(table.bookingId)]
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
    // "confirmation" | "voucher" | "receipt" | "custom"
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
  activities: many(activityLog),
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

export const bookingItemRelations = relations(bookingItem, ({ one }) => ({
  booking: one(booking, {
    fields: [bookingItem.bookingId],
    references: [booking.id],
  }),
}));
