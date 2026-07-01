# Schema Reference

Full per-table, per-column reference. Schema is Drizzle ORM + PostgreSQL (Neon).
Source of truth: `src/lib/schema.ts`. High-level overview: [database.md](database.md).

Convention — `id` is always `uuid PRIMARY KEY DEFAULT gen_random_uuid()` on
business tables unless noted. Better Auth tables use `text` PKs. All timestamps
are `timestamptz`.

---

## Auth — Better Auth managed

### `user`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `text` | PK | Better Auth managed |
| `name` | `text` | NOT NULL | Display name |
| `email` | `text` | NOT NULL UNIQUE | Login credential |
| `email_verified` | `boolean` | NOT NULL DEFAULT false | |
| `image` | `text` | | Avatar URL |
| `agency_id` | `uuid` | FK → `agency` CASCADE | null = platform admin or not yet onboarded |
| `is_platform_admin` | `boolean` | NOT NULL DEFAULT false | Vendor console access |
| `role` | `text` | NOT NULL DEFAULT `"agent"` | `admin \| manager \| finance \| support \| agent` |
| `locale` | `text` | | `"en" \| "fr" \| "ar"` — UI language preference |
| `active` | `boolean` | NOT NULL DEFAULT true | Soft-disable without deleting history |
| `commission_rate_percent` | `numeric(5,2)` | | Default commission % this agent earns |
| `created_at` | `timestamp` | NOT NULL DEFAULT now() | |
| `updated_at` | `timestamp` | NOT NULL | Auto-set on update |

**Indexes:** `user_email_idx`, `user_agency_idx`

### `session`

| Column | Type | Notes |
|---|---|---|
| `id` | `text` | PK |
| `expires_at` | `timestamp` | NOT NULL |
| `token` | `text` | NOT NULL UNIQUE |
| `ip_address` | `text` | |
| `user_agent` | `text` | |
| `user_id` | `text` | FK → `user` CASCADE |
| `created_at` | `timestamp` | NOT NULL |
| `updated_at` | `timestamp` | NOT NULL |

### `account`

OAuth/credential accounts linked to a user. Better Auth managed.

| Column | Type |
|---|---|
| `id` | `text` PK |
| `account_id` | `text` NOT NULL |
| `provider_id` | `text` NOT NULL |
| `user_id` | `text` FK → `user` CASCADE |
| `access_token`, `refresh_token`, `id_token` | `text` |
| `access_token_expires_at`, `refresh_token_expires_at` | `timestamp` |
| `scope`, `password` | `text` |

### `verification`

Magic-link / email verification tokens. Better Auth managed.

| Column | Type |
|---|---|
| `id` | `text` PK |
| `identifier` | `text` NOT NULL |
| `value` | `text` NOT NULL |
| `expires_at` | `timestamp` NOT NULL |

---

## Agency & onboarding

### `agency`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `name` | `text` | NOT NULL |
| `slug` | `text` | NOT NULL UNIQUE |
| `status` | `text` | `"active" \| "suspended"` DEFAULT `"active"` |
| **Stripe billing** | | |
| `stripe_customer_id` | `text` | |
| `stripe_subscription_id` | `text` | |
| `subscription_status` | `text` | Stripe status string |
| `price_id` | `text` | Stripe price for the current plan |
| `current_period_end` | `timestamp` | Subscription period end |
| `trial_ends_at` | `timestamp` | 14-day trial expiry on first provision |
| **Stripe Connect** | | |
| `stripe_connect_account_id` | `text` | Agency's Express account |
| `stripe_connect_onboarded` | `boolean` | DEFAULT false — true after Connect flow |
| **Onboarding** | | |
| `onboarding_dismissed_at` | `timestamp` | Set when agency dismisses the getting-started card |
| `created_at` | `timestamp` | NOT NULL |
| `updated_at` | `timestamp` | NOT NULL |

### `agency_invite`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `agency_id` | `uuid` | FK → `agency` CASCADE |
| `email` | `text` | NOT NULL |
| `role` | `text` | NOT NULL — target role after sign-up |
| `token` | `text` | NOT NULL UNIQUE — unguessable magic link |
| `status` | `text` | `"pending" \| "accepted" \| "expired"` DEFAULT `"pending"` |
| `invited_by_id` | `text` | FK → `user` SET NULL |
| `expires_at` | `timestamp` | NOT NULL |
| `created_at` | `timestamp` | NOT NULL |

---

## CRM

### `client`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `agency_id` | `uuid` | FK → `agency` CASCADE |
| `name` | `text` | NOT NULL |
| `type` | `text` | `"individual" \| "corporate"` DEFAULT `"individual"` |
| `status` | `text` | `"lead" \| "active" \| "inactive"` DEFAULT `"active"` |
| `email` | `text` | |
| `phone` | `text` | |
| `company` | `text` | Corporate name |
| `address` | `text` | |
| `city` | `text` | |
| `country` | `text` | Canonical ISO 3166-1 name (full name, not code) |
| `source` | `text` | Lead-source vocab code |
| `industry` | `text` | Industry vocab code (corporate clients) |
| `notes` | `text` | |
| `owner_id` | `text` | FK → `user` SET NULL — relationship owner |
| `created_by_id` | `text` | FK → `user` SET NULL |
| `created_at` | `timestamp` | NOT NULL |
| `updated_at` | `timestamp` | NOT NULL |

**Indexes:** `client_agency_idx`, `client_owner_idx`, `client_status_idx`, `client_name_idx`, `client_agency_created_idx`
**Unique:** none (names may repeat)

### `client_contact`

Additional contacts for corporate clients.

| Column | Type |
|---|---|
| `id` | `uuid` PK |
| `client_id` | `uuid` FK → `client` CASCADE NOT NULL |
| `name` | `text` NOT NULL |
| `job_title` | `text` |
| `email` | `text` |
| `phone` | `text` |
| `is_primary` | `boolean` DEFAULT false NOT NULL |
| `created_at` | `timestamp` NOT NULL |

---

## Sales pipeline

### `opportunity`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `agency_id` | `uuid` | FK → `agency` CASCADE |
| `title` | `text` | NOT NULL |
| `client_id` | `uuid` | FK → `client` CASCADE NOT NULL |
| `stage` | `text` | `"lead" \| "qualified" \| "proposal" \| "booked" \| "won" \| "lost"` DEFAULT `"lead"` |
| `value` | `numeric(12,2)` | DEFAULT 0 |
| `currency` | `text` | DEFAULT `"EUR"` |
| `probability` | `integer` | 0–100 DEFAULT 10 |
| `destination` | `text` | |
| `travel_start_date` | `timestamp` | |
| `travel_end_date` | `timestamp` | |
| `pax_count` | `integer` | DEFAULT 1 |
| `travel_purpose` | `text` | Vocab code |
| `expected_close_date` | `timestamp` | |
| `lost_reason` | `text` | Vocab code — only when stage = `"lost"` |
| `notes` | `text` | |
| `assigned_to_id` | `text` | FK → `user` SET NULL |
| `created_by_id` | `text` | FK → `user` SET NULL |
| `created_at` | `timestamp` | NOT NULL |
| `updated_at` | `timestamp` | NOT NULL |

**Indexes:** `opportunity_agency_idx`, `opportunity_client_idx`, `opportunity_stage_idx`, `opportunity_assigned_idx`, `opportunity_agency_stage_idx`, `opportunity_agency_created_idx`

---

## Proposals (Products)

### `product`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `agency_id` | `uuid` | FK → `agency` CASCADE |
| `reference` | `text` | NOT NULL — e.g. `"PRD-1042"` unique per agency |
| `title` | `text` | NOT NULL |
| `client_id` | `uuid` | FK → `client` SET NULL |
| `opportunity_id` | `uuid` | FK → `opportunity` SET NULL |
| `status` | `text` | `"draft" \| "sent" \| "accepted" \| "rejected" \| "expired"` DEFAULT `"draft"` |
| `destination` | `text` | |
| `start_date`, `end_date` | `timestamp` | |
| `pax_count` | `integer` | DEFAULT 1 |
| `currency` | `text` | DEFAULT `"EUR"` |
| `markup_percent` | `numeric(5,2)` | DEFAULT 0 |
| `total_cost` | `numeric(12,2)` | DEFAULT 0 |
| `total_price` | `numeric(12,2)` | DEFAULT 0 |
| `summary` | `text` | Client-facing narrative (AI-generated) |
| `valid_until` | `timestamp` | |
| **E-signature** | | |
| `share_token` | `text` | UNIQUE — public `/p/[token]` link |
| `accepted_at`, `declined_at` | `timestamp` | |
| `signer_name`, `signer_email` | `text` | Non-repudiation |
| `signature_data` | `text` | Typed name or drawn-signature data URL |
| `signer_ip`, `signer_user_agent` | `text` | |
| `created_by_id` | `text` | FK → `user` SET NULL |
| `created_at`, `updated_at` | `timestamp` | NOT NULL |

**Unique:** `product_agency_reference_unique (agency_id, reference)`

### `product_item`

Line items within a proposal.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `product_id` | `uuid` | FK → `product` CASCADE NOT NULL |
| `supplier_id` | `uuid` | FK → `supplier` SET NULL (optional) |
| `type` | `text` | `"flight" \| "hotel" \| "activity" \| "transfer" \| "insurance" \| "other"` |
| `title` | `text` | NOT NULL |
| `description`, `supplier` | `text` | |
| `quantity` | `integer` | DEFAULT 1 NOT NULL |
| `unit_cost`, `unit_price` | `numeric(12,2)` | DEFAULT 0 NOT NULL |
| `currency` | `text` | DEFAULT `"EUR"` |
| `start_date`, `end_date` | `timestamp` | |
| `details` | `jsonb` | Raw supplier offer payload |
| `sort_order` | `integer` | DEFAULT 0 |
| `created_at` | `timestamp` | NOT NULL |

---

## Bookings

### `booking`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `agency_id` | `uuid` | FK → `agency` CASCADE |
| `reference` | `text` | NOT NULL — e.g. `"BKG-1042"` unique per agency |
| `client_id` | `uuid` | FK → `client` SET NULL |
| `status` | `text` | `"draft" \| "awaiting_payment" \| "confirmed" \| "ticketed" \| "completed" \| "cancelled"` DEFAULT `"draft"` |
| `destination` | `text` | |
| `depart_date`, `return_date` | `timestamp` | |
| `travel_purpose` | `text` | Vocab code |
| `trip_type` | `text` | `"one_way" \| "round_trip" \| "multi_city"` |
| `currency` | `text` | DEFAULT `"EUR"` |
| `notes` | `text` | |
| `total_amount` | `numeric(12,2)` | DEFAULT 0 |
| `share_token` | `text` | UNIQUE — shareable itinerary `/i/[token]` |
| `created_by_id` | `text` | FK → `user` SET NULL |
| `created_at`, `updated_at` | `timestamp` | NOT NULL |

**Lifecycle prerequisite rules (server-side enforced):**
- `confirmed` requires: trip items present AND zero outstanding balance.
- `ticketed` requires: trip items present.

**Unique:** `booking_agency_reference_unique (agency_id, reference)`

### `booking_traveller`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `booking_id` | `uuid` | FK → `booking` CASCADE NOT NULL |
| `full_name` | `text` | NOT NULL |
| `title` | `text` | Vocab code (`mr \| mrs \| ms \| dr \| prof`) |
| `gender` | `text` | Vocab code (`male \| female \| unspecified`) |
| `passport_number` | `text` | |
| `passport_expiry` | `timestamp` | |
| `nationality` | `text` | ISO country name |
| `date_of_birth` | `timestamp` | |
| `passport_issue_date`, `passport_issue_place` | `timestamp / text` | |
| `email` | `text` | Required by Duffel for lead passenger |
| `phone` | `text` | Required by Duffel for lead passenger |
| `is_lead` | `boolean` | NOT NULL DEFAULT false — first passenger = lead |
| `sort_order` | `integer` | DEFAULT 0 |
| `created_at` | `timestamp` | NOT NULL |

### `booking_item`

A purchased line item (flight, hotel, transfer, fee, etc.).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `booking_id` | `uuid` | FK → `booking` CASCADE NOT NULL |
| `supplier_id` | `uuid` | FK → `supplier` SET NULL (optional) |
| `type` | `text` | `"flight" \| "hotel" \| "excursion" \| "transfer" \| "insurance" \| "fee" \| "other"` |
| `title` | `text` | NOT NULL |
| `description`, `supplier` | `text` | |
| `booking_ref` | `text` | Supplier confirmation / PNR reference |
| `start_date`, `end_date` | `timestamp` | |
| `quantity` | `integer` | DEFAULT 1 |
| `amount` | `numeric(12,2)` | DEFAULT 0 — price charged to client (per unit) |
| `currency` | `text` | DEFAULT `"EUR"` |
| `item_status` | `text` | `"pending" \| "confirmed" \| "ticketed" \| "cancelled"` DEFAULT `"pending"` |
| `confirmation_number` | `text` | Supplier confirmation number once booked |
| `day_index` | `integer` | Itinerary day (0-based from departure; null = auto by date) |
| `details` | `jsonb` | Raw supplier offer payload |
| `sort_order` | `integer` | DEFAULT 0 |
| `created_at` | `timestamp` | NOT NULL |

### `payment`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `booking_id` | `uuid` | FK → `booking` CASCADE NOT NULL |
| `amount` | `numeric(12,2)` | NOT NULL |
| `currency` | `text` | DEFAULT `"EUR"` |
| `kind` | `text` | `"deposit" \| "installment" \| "payment" \| "refund"` DEFAULT `"payment"` |
| `method` | `text` | `"manual" \| "card" \| "transfer" \| "cash" \| "stripe"` DEFAULT `"manual"` |
| `status` | `text` | `"pending" \| "completed" \| "failed" \| "refunded"` DEFAULT `"completed"` |
| `reference` | `text` | Stripe payment id or manual reference |
| `stripe_session_id` | `text` | Stripe Checkout Session id (Connect flow) |
| `checkout_url` | `text` | Hosted Checkout URL sent to client |
| `note` | `text` | |
| `created_by_id` | `text` | FK → `user` SET NULL |
| `created_at` | `timestamp` | NOT NULL |

### `booking_day`

Per-day itinerary titles and notes.

| Column | Type |
|---|---|
| `id` | `uuid` PK |
| `booking_id` | `uuid` FK → `booking` CASCADE NOT NULL |
| `day_index` | `integer` NOT NULL (0-based) |
| `title` | `text` |
| `notes` | `text` |

### `notification`

Communications log.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `agency_id` | `uuid` | FK → `agency` CASCADE |
| `booking_id` | `uuid` | FK → `booking` CASCADE (nullable) |
| `channel` | `text` | `"email" \| "sms" \| "whatsapp" \| "push"` DEFAULT `"email"` |
| `recipient` | `text` | NOT NULL — email address or phone |
| `subject` | `text` | |
| `body` | `text` | |
| `kind` | `text` | `"confirmation" \| "voucher" \| "receipt" \| "custom" \| "invite" \| "proposal"` DEFAULT `"custom"` |
| `status` | `text` | `"sent" \| "failed" \| "logged"` DEFAULT `"sent"` |
| `error` | `text` | Error message when status = `"failed"` |
| `created_by_id` | `text` | FK → `user` SET NULL |
| `created_at` | `timestamp` | NOT NULL |

---

## Sprint 1 — Booking lifecycle tables

### `booking_supplier_ref`

Structured supplier confirmation. Replaces ad-hoc JSONB in `booking_item.details`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `booking_id` | `uuid` | FK → `booking` CASCADE NOT NULL |
| `booking_item_id` | `uuid` | FK → `booking_item` CASCADE NOT NULL |
| `provider_id` | `text` | NOT NULL — `"duffel" \| "hotelbeds" \| "mock"` |
| `confirmation_number` | `text` | NOT NULL — shown to client |
| `pnr` | `text` | Airline PNR / record locator |
| `supplier_order_id` | `text` | Provider's internal order id (e.g. Duffel `order_xxx`) |
| `raw_payload` | `jsonb` | Full raw response for debugging |
| `created_at` | `timestamp` | NOT NULL |

**Indexes:** `booking_supplier_ref_booking_idx`, `booking_supplier_ref_item_idx`, `booking_supplier_ref_provider_idx`

### `booking_event`

Append-only audit + analytics log. Never update or delete rows.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `booking_id` | `uuid` | FK → `booking` CASCADE NOT NULL |
| `agency_id` | `uuid` | FK → `agency` CASCADE NOT NULL (for agency-scoped analytics) |
| `event` | `text` | NOT NULL — stable event code (see [booking-architecture.md §6](booking-architecture.md)) |
| `provider_id` | `text` | `"duffel"`, `"hotelbeds"`, `"mock"`, or null for UI events |
| `correlation_id` | `text` | Request-level trace id |
| `metadata` | `jsonb` | Structured payload (offer id, price, error code, etc.) |
| `created_at` | `timestamp` | NOT NULL |

**Event codes:** `search_initiated`, `offer_selected`, `price_validated`, `price_changed`, `booking_submitted`, `booking_confirmed`, `booking_failed`, `booking_cancelled`, `payment_started`, `payment_completed`

**Indexes:** `booking_event_booking_idx`, `booking_event_agency_idx`, `booking_event_event_idx`, `booking_event_created_idx`, `booking_event_booking_created_idx`

### `booking_document`

Documents generated for a booking (vouchers, tickets, invoices, itineraries).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `booking_id` | `uuid` | FK → `booking` CASCADE NOT NULL |
| `booking_item_id` | `uuid` | FK → `booking_item` SET NULL (null = booking-level doc) |
| `type` | `text` | NOT NULL — `"voucher" \| "ticket" \| "invoice" \| "itinerary" \| "receipt"` |
| `provider_id` | `text` | Supplier that issued the document |
| `url` | `text` | Vercel Blob URL or supplier CDN link |
| `raw_data` | `jsonb` | Supplier payload for re-generation |
| `generated_at` | `timestamp` | When the document was issued |
| `created_at` | `timestamp` | NOT NULL |

### `booking_idempotency`

Key registry preventing duplicate supplier orders on retry.

| Column | Type | Notes |
|---|---|---|
| `key` | `text` | PK — sha256(bookingId:itemId:offerId) |
| `booking_id` | `uuid` | FK → `booking` CASCADE NOT NULL |
| `booking_item_id` | `uuid` | FK → `booking_item` CASCADE |
| `provider_id` | `text` | NOT NULL — provider the key was sent to |
| `status` | `text` | `"pending" \| "success" \| "failed"` DEFAULT `"pending"` |
| `supplier_ref` | `text` | Confirmation number when status = `"success"` |
| `created_at` | `timestamp` | NOT NULL |
| `expires_at` | `timestamp` | NOT NULL — 24h TTL; safe to clean up after expiry |

**Indexes:** `booking_idempotency_booking_idx`, `booking_idempotency_expires_idx`

---

## Supplier management

### `supplier`

Agency's managed supplier directory (hotels, airlines, DMCs, etc.).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `agency_id` | `uuid` | FK → `agency` CASCADE |
| `name` | `text` | NOT NULL — unique per agency |
| `type` | `text` | `"hotel" \| "airline" \| "car_rental" \| "transfer" \| "dmc" \| "insurance" \| "other"` |
| `status` | `text` | `"active" \| "inactive"` DEFAULT `"active"` |
| `email`, `phone`, `website` | `text` | |
| `address`, `city`, `country` | `text` | |
| `contact_name` | `text` | |
| `notes` | `text` | |
| `created_by_id` | `text` | FK → `user` SET NULL |
| `created_at`, `updated_at` | `timestamp` | NOT NULL |

**Unique:** `supplier_agency_name_unique (agency_id, name)`

### `supplier_contract`

Commercial contracts with commission terms.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `supplier_id` | `uuid` | FK → `supplier` CASCADE NOT NULL |
| `agency_id` | `uuid` | FK → `agency` CASCADE (denormalized for query efficiency) |
| `name` | `text` | NOT NULL |
| `reference` | `text` | Contract number |
| `commission_basis` | `text` | `"percent" \| "fixed" \| "net"` |
| `commission_rate` | `numeric(5,2)` | % or fixed amount depending on basis |
| `valid_from`, `valid_to` | `timestamp` | |
| `file_url` | `text` | Vercel Blob URL for the PDF contract |
| `notes` | `text` | |
| `created_at`, `updated_at` | `timestamp` | NOT NULL |

### `supplier_rate`

Structured per-product rates within a contract.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `contract_id` | `uuid` | FK → `supplier_contract` CASCADE NOT NULL |
| `name`, `description` | `text` | |
| `rate_type` | `text` | Type of rate (product/season/tier) |
| `amount` | `numeric(12,2)` | |
| `currency` | `text` | |
| `valid_from`, `valid_to` | `timestamp` | |
| `created_at` | `timestamp` | NOT NULL |

### `commission`

Two-ledger earnings record. Auto-generated on booking confirm/ticket.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `agency_id` | `uuid` | FK → `agency` CASCADE |
| `booking_id` | `uuid` | FK → `booking` SET NULL (nullable) — ledger survives booking deletion (migration `0021`) |
| `booking_item_id` | `uuid` | FK → `booking_item` SET NULL (nullable) — same rationale as `booking_id` |
| `supplier_id` | `uuid` | FK → `supplier` SET NULL |
| `agent_user_id` | `text` | FK → `user` SET NULL |
| `ledger` | `text` | `"supplier_to_agency" \| "agency_to_agent"` |
| `basis` | `text` | `"percent" \| "fixed" \| "net"` |
| `rate` | `numeric(5,2)` | |
| `amount` | `numeric(12,2)` | NOT NULL — computed commission |
| `currency` | `text` | |
| `status` | `text` | `"pending" \| "confirmed" \| "paid" \| "cancelled"` |
| `notes` | `text` | |
| `created_at`, `updated_at` | `timestamp` | NOT NULL |

---

## Client portal

### `portal_session`

Passwordless sessions for the client-facing traveler portal. Entirely
separate from the Better Auth staff session system.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `client_id` | `uuid` | FK → `client` CASCADE NOT NULL |
| `token` | `text` | NOT NULL UNIQUE — magic-link token (15 min) → session token (7 days) |
| `purpose` | `text` | NOT NULL, default `'session'` — `'magic'` \| `'session'` (migration `0021`) |
| `expires_at` | `timestamp` | NOT NULL |
| `created_at` | `timestamp` | NOT NULL |

Magic-link flow: token is short-lived (15 min); on verification the row is
updated with a rotated long-lived (7-day) token **and** `purpose` flips from
`'magic'` to `'session'`, stored in an httpOnly cookie. `purpose` discriminates
the two so a magic-link row can never authenticate a normal portal request —
only `purpose = 'session'` rows are accepted as session bearers, and only
`purpose = 'magic'` rows are accepted by the verify step.

---

## Reference data (global, not tenant-scoped)

### `hotel_content`

Hotelbeds Content API cache. PK is the Hotelbeds hotel code (text), **not** UUID.
Shared across all agencies — intentionally not scoped to `agency_id`.

| Column | Type | Notes |
|---|---|---|
| `code` | `text` | PK — Hotelbeds hotel code (e.g. `"12345"`) |
| `name` | `text` | NOT NULL |
| `stars` | `integer` | DEFAULT 0 |
| `hotel_type` | `text` | |
| `description` | `text` | |
| `address`, `city`, `country`, `postal_code` | `text` | |
| `latitude`, `longitude` | `numeric(10,6)` | |
| `destination_code` | `text` | Hotelbeds destination code (e.g. `"BCN"`) |
| `segments` | `jsonb` | Marketing segment tags: `string[]` |
| `facilities` | `jsonb` | Amenity names: `string[]` |
| `images` | `jsonb` | `{ url: string; roomCode?: string }[]` |
| `updated_at` | `timestamp` | NOT NULL — sync timestamp |

**Index:** `hotel_content_destination_idx (destination_code)`

---

## Audit

### `activity_log`

Records every meaningful action for manager oversight.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `agency_id` | `uuid` | FK → `agency` CASCADE |
| `user_id` | `text` | FK → `user` SET NULL |
| `action` | `text` | `"created" \| "updated" \| "deleted" \| "stage_changed" \| "sent" \| "status_changed"` |
| `entity_type` | `text` | `"client" \| "opportunity" \| "product" \| "user"` |
| `entity_id` | `text` | |
| `entity_label` | `text` | Human-readable name kept even if entity is deleted |
| `metadata` | `jsonb` | Diff / context payload |
| `created_at` | `timestamp` | NOT NULL |

**Indexes:** `activity_agency_idx`, `activity_user_idx`, `activity_entity_idx (entity_type, entity_id)`, `activity_created_idx`

---

## Migrations summary

| Migration | Description |
|---|---|
| `0000`–`0005` | Pre-tenancy base schema (not itemized) |
| `0006` | Multi-tenant `agencyId` backfill |
| `0007` | `agency_invite` |
| `0008` | `user.locale` |
| `0009` | Agency Stripe billing columns |
| `0010` | Product e-signature columns |
| `0011` | `hotel_content` cache |
| `0012` | Stripe Connect columns on `agency` |
| `0013` | `portal_session` |
| `0014` | `supplier`, `supplier_contract`, `supplier_rate`; `supplier_id` FK on `booking_item` + `product_item` |
| `0015` | `commission`; `user.commission_rate_percent` |
| `0016` | `agency.onboarding_dismissed_at` |
| `0017` | Controlled-vocab columns (additive, nullable): `client.industry`, `opportunity.travel_purpose`, `booking.travel_purpose`/`trip_type`, `booking_traveller.title`/`gender` |
| `0018` | `commission.booking_item_id` FK re-pointed at `booking_item`; agency/status/created perf indexes across `booking`, `client`, `commission`, `notification`, `opportunity`, `product`, plus `booking_item.supplier_id`, `product_item.supplier_id`, `verification.identifier` |
| `0019` | Sprint 1: `booking_supplier_ref`, `booking_event`, `booking_document`, `booking_idempotency`; `booking_traveller.email` + `.phone` |
| `0020` | `product.converted_booking_id` (FK → `booking`, `set null`) — proposal→booking idempotency latch |
| `0021` | `commission.booking_id` + `.booking_item_id` FKs `cascade` → `set null` (ledger survives booking/item deletion); `commission_item_idx`, `commission_supplier_idx`, `product_converted_booking_idx`; `portal_session.purpose` (`'magic'` \| `'session'`, default `'session'`) |
