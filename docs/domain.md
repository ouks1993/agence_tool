# Domain Model

The core business entities and how they relate. This is the **data/relationship**
view; the process view (states, who does what) is the
[golden workflow](business-rules.md#golden-workflow). Tables and columns live in
[database.md](database.md); the full column-by-column listing is in
[schema-reference.md](schema-reference.md). All tables are declared in
`src/lib/schema.ts`; the shared status/type vocabularies live in `src/lib/domain.ts`.

## The chain

```
Lead → Client → Opportunity → Proposal → Booking → Supplier →
Invoice → Payment → Accounting → Travel → Feedback
```

The **client is the aggregate root** — everything hangs off it, and every
business entity is scoped to an `agencyId` (founding principle #2). The chain is
partly aspirational: three links (Invoice, Accounting, Feedback) are not yet
first-class entities — see [Where the chain is aspirational](#where-the-chain-is-aspirational).

## Entities

| Domain concept | Table(s) | Status | Key relations |
|---|---|---|---|
| **Lead** | `client` (status `lead`, `source` code) | ✅ | becomes a Client; no separate table |
| **Client** | `client` (+ `client_contact`) | ✅ | root; owns opportunities, proposals, bookings, portal sessions |
| **Opportunity** | `opportunity` | ✅ | belongs to a client; `assignedToId`; links to a proposal |
| **Proposal** | `product` (+ `product_item`) | ✅ | belongs to client + opportunity; e-sign; converts → Booking |
| **Booking** | `booking` (+ `booking_traveller`, `booking_item`, `booking_day`, `payment`, `booking_supplier_ref`, `booking_event`, `booking_document`, `booking_idempotency`) | ✅ | belongs to client; lifecycle states; items reference suppliers; Sprint 1 tables power real booking, audit log, and idempotency |
| **Supplier** | `supplier` (+ `supplier_contract`, `supplier_rate`) | ✅ | referenced by `booking_item.supplierId` + `product_item.supplierId` |
| **Invoice** | — (on-demand PDF at `/booking-docs/[id]/invoice`) | 🟡 | no managed invoice entity yet (planned module) |
| **Payment** | `payment` (child of booking) | ✅ | deposits/installments/refunds; Stripe Connect |
| **Accounting** | `commission` ledger only | 🟡 | partial; no GL/accounting entity (planned module) |
| **Travel** | `booking` (state `completed`) + `booking_day` + `booking_document` | ✅ | itinerary timeline; vouchers/tickets |
| **Feedback** | — (`activity_log` / notes) | 🔴 | no review/feedback entity (planned module) |

The supporting tables — `agency`, `agency_invite`, `user`, `session`, `account`,
`verification`, `portal_session`, `notification`, `activity_log`, `hotel_content` —
are documented in [Supporting entities](#supporting-entities) below.

## Entity lifecycle chain (Lead → … → Feedback)

Each hop advances the same client relationship through the golden workflow. The
status/type vocabularies below are the canonical values from `src/lib/domain.ts`;
they are stored as plain text codes (never renamed — only appended) so historical
reporting stays stable.

### Lead → Client

There is **no separate lead table**. A lead is a `client` row whose `status` is
`lead` (`CLIENT_STATUSES = lead | active | inactive`). The `source` column records
acquisition via a `LEAD_SOURCES` code (`referral`, `website`, `instagram`,
`facebook`, `walk_in`, `partner`, `event`, `outbound`, `repeat`, `other`). A
corporate client also carries an `industry` code (`INDUSTRIES`). Qualifying a lead
is a status change on the same row — the relationship (and its `id`) is preserved.

### Client → Opportunity

An `opportunity` is a deal in the sales pipeline. It **must** belong to a client
(`clientId` is `NOT NULL`, `onDelete: cascade`) and progresses through
`OPPORTUNITY_STAGES` (`lead → qualified → proposal → booked → won → lost`). Each
stage carries a `defaultProbability`; the open pipeline is `OPEN_STAGES`
(`lead`, `qualified`, `proposal`, `booked`). A lost deal records a `lostReason`
code (`LOST_REASONS`) for win/loss analysis, and a `travelPurpose` code
(`TRAVEL_PURPOSES`) drives segmentation. `value` + `currency` size the deal;
`assignedToId` is the owning agent.

### Opportunity → Proposal

A `product` is the proposal — a priced travel package assembled from supplier
offers. It optionally links back to both a `clientId` and an `opportunityId`
(both `onDelete: set null`), so a proposal survives if the deal is deleted.
Statuses are `PRODUCT_STATUSES` (`draft → sent → accepted → rejected → expired`).
Line items live in `product_item` (`PRODUCT_ITEM_TYPES`: `flight`, `hotel`,
`activity`, `transfer`, `insurance`, `other`), each optionally tied to a managed
`supplierId`. Pricing is computed from `unitCost`/`unitPrice` per item plus a
`markupPercent` on the parent. The `reference` (e.g. `PRD-1042`) is unique per
agency (`product_agency_reference_unique`).

**E-signature acceptance.** A proposal is shared via an unguessable `shareToken`
at the public route `/p/[token]`. On accept/decline the row captures `acceptedAt`
or `declinedAt` plus non-repudiation fields: `signerName`, `signerEmail`,
`signatureData` (typed-name or drawn signature), `signerIp`, `signerUserAgent`.

### Proposal → Booking

A `booking` is the booking file for one trip. `clientId` is `onDelete: set null`
(the file survives client deletion). The **operational lifecycle** is
`BOOKING_LIFECYCLE` from `src/lib/domain.ts`:

| Status | Meaning |
|---|---|
| `draft` | Being assembled |
| `awaiting_payment` | Priced, waiting on client payment |
| `confirmed` | Client committed; supplier booking in progress |
| `ticketed` | Supplier orders issued (e-tickets/vouchers) |
| `completed` | Travel done |
| `cancelled` | Terminated (outside the ordered lifecycle) |

`nextBookingStatus()` advances one step along `BOOKING_LIFECYCLE`. Advancing to
`ticketed` has a hard prerequisite — items are booked with the supplier first, and
the advance aborts if confirmation fails (see `src/lib/actions/bookings.ts`).
`travelPurpose` (`TRAVEL_PURPOSES`) and `tripType` (`TRIP_TYPES`: `one_way`,
`round_trip`, `multi_city`) classify the trip. `reference` (e.g. `BKG-1042`) is
unique per agency; a `shareToken` powers the public itinerary at `/i/[token]`.

> **Doc note:** the inline comment on `booking.status` in `schema.ts`
> (`draft | confirmed | paid | cancelled`) is stale — the live six-state
> vocabulary is the `BOOKING_STATUSES` constant in `src/lib/domain.ts`.

Booking children:

| Child table | Purpose |
|---|---|
| `booking_traveller` | Travellers + passport data; `title`/`gender` codes (`TITLES`/`GENDERS`); `email`/`phone` required by supplier APIs on the lead pax (`isLead`) |
| `booking_item` | Purchased lines (`BOOKING_ITEM_TYPES`: `flight`, `hotel`, `transfer`, `excursion`, `insurance`, `fee`, `other`); `itemStatus` = `pending | confirmed | ticketed | cancelled`; optional `supplierId`; `dayIndex` for the timeline |
| `booking_day` | Per-day title/notes for the itinerary timeline |
| `payment` | Deposits, installments, payments, refunds (see below) |
| `booking_supplier_ref` | Structured supplier confirmation (replaces untyped JSONB) |
| `booking_event` | Append-only event log (audit + analytics) |
| `booking_document` | Generated vouchers/tickets/invoices/itineraries/receipts |
| `booking_idempotency` | Idempotency-key registry for supplier calls |

### Booking → Supplier

Items reference the agency's managed `supplier` directory via
`booking_item.supplierId` (and `product_item.supplierId`); a free-text `supplier`
string remains for ad-hoc entries. `SUPPLIER_TYPES` are `hotel`, `airline`,
`car_rental`, `transfer`, `dmc`, `insurance`, `other`. Commercial terms live in
`supplier_contract` (`commissionBasis` = `percent | fixed | net`, validity window,
`fileUrl`) with structured `supplier_rate` rows (`netRate`/`sellRate`). Actual
supplier confirmations are captured on `booking_supplier_ref`: `providerId`
(`duffel`, `hotelbeds`, `mock`, …), `confirmationNumber`, `pnr`, `supplierOrderId`,
and the full `rawPayload`.

### Booking → Invoice (aspirational)

There is **no managed invoice entity**. Invoices are rendered on-demand as PDFs at
`/booking-docs/[id]/invoice` (voucher counterpart at `/booking-docs/[id]/voucher`).
A generated document may be persisted as a `booking_document` row of `type`
`invoice`. Turning this into a numbered, ledgered record is the Accounting module.

### Booking → Payment

`payment` records money against a booking (`onDelete: cascade`). `kind` =
`deposit | installment | payment | refund` (`PAYMENT_KINDS`); `method` =
`manual | card | transfer | cash | stripe` (`PAYMENT_METHODS`); `status` =
`pending | completed | failed | refunded`. Stripe **Connect** (traveler → agency)
fields — `stripeSessionId`, `checkoutUrl` — reconcile hosted Checkout via webhook.
This is distinct from the agency's SaaS billing on `agency` (vendor → agency).

### Payment → Accounting (partial)

The only accounting primitive is the `commission` ledger (`COMMISSION_TYPES`):

| Type | Direction | Links |
|---|---|---|
| `supplier_to_agency` | Agency earns from a supplier for a booking item | `supplierId` + `bookingItemId` |
| `agency_to_agent` | Agent earns from the agency for a booking | `agentUserId` + `bookingId` |

`basis` = `percent | fixed`; `status` = `pending | earned | invoiced | paid | void`
(`COMMISSION_STATUSES`). Commission auto-generates on booking confirm/ticket; no
general ledger exists.

### Travel → Feedback (aspirational)

Travel is the `booking` reaching `completed`, with the itinerary rendered from
`booking_day` + `booking_item` and vouchers/tickets in `booking_document`.
**Feedback is not modelled** — "Travel completed → request review" is an unbuilt
[automation trigger](business-rules.md#automation-triggers). Today only
`activity_log` and free-text `notes` capture post-trip signal.

## Aggregates & ownership

An aggregate is a root plus the children that share its lifecycle and are only ever
loaded/mutated through it.

- **Client aggregate** — `client` → `client_contact`; the spine that opportunities,
  proposals, bookings, and portal sessions all reference by `clientId`. `ownerId`
  is the agent who owns the relationship (`relationName: "client_owner"`).
- **Opportunity** — a first-class root scoped by `agencyId`, but conceptually a
  child of the client aggregate (its `clientId` cascade-deletes with the client).
- **Proposal aggregate** — `product` → `product_item`. Root scoped by `agencyId`;
  soft-linked (`set null`) to client + opportunity so it survives their deletion.
- **Booking aggregate** — `booking` → `booking_traveller`, `booking_item`,
  `booking_day`, `payment`, `booking_supplier_ref`, `booking_event`,
  `booking_document`, `booking_idempotency`. Most children carry **no** `agencyId`;
  they inherit tenancy through the parent booking (scoped via the parent on every
  query). The exception is `booking_event`, which **denormalizes `agencyId`** for
  direct tenant-scoped analytics queries. `booking_event` is append-only (audit +
  analytics); `booking_idempotency` (PK = the derived key) prevents duplicate
  supplier orders on retry, with a 24 h `expiresAt` TTL.
- **Supplier aggregate** — `supplier` → `supplier_contract` → `supplier_rate`.
  `supplier_contract` denormalizes `agencyId` for efficient agency-scoped queries;
  `supplier_rate` inherits tenancy through its contract. `commission` rows link a
  booking item back to the earning supplier/agent.
- **Reference data** — `hotel_content` is **global** (not tenant-scoped): its PK is
  the Hotelbeds hotel code (a string), and it is shared vendor reference data like a
  currency list. ISO countries/controlled vocabularies are canonical lookups in
  `src/lib/domain.ts`, not per-agency rows.

## Supporting entities

| Table | Role |
|---|---|
| `agency` | The tenant. `status` (`active`/`suspended`); SaaS-billing (Stripe customer/subscription) + Stripe **Connect** columns; `onboardingDismissedAt` |
| `agency_invite` | Invitation-only registration: `email`, `role`, unguessable `token`, `status` (`pending`/`accepted`/`revoked`), `expiresAt` |
| `user` | Team member (Better Auth). `agencyId` (NULL only for the platform super-admin), `role`, `active`, `locale`, `commissionRatePercent`, `isPlatformAdmin` |
| `session`, `account`, `verification` | Better Auth staff sessions/credentials (text ids — managed by Better Auth) |
| `portal_session` | Passwordless **client** portal session (separate from Better Auth): 15 min magic token rotated to a 7-day session token; scoped to one `clientId` |
| `notification` | Communications log: `channel` (`email`/`sms`/`whatsapp`/`push`), `kind`, `status`, optional `bookingId` |
| `activity_log` | Manager-oversight audit trail: `action`, `entityType`, `entityId`, `entityLabel`, `metadata` |
| `hotel_content` | Global Hotelbeds content cache (photos, facilities, coords); **not** tenant-scoped |

## Tenant scoping

Every business table (except the global `hotel_content`) carries a tenancy path
back to `agency`, enforced at the application layer — Postgres has no row-level
security here.

- **Root tables** carry `agencyId uuid NOT NULL REFERENCES agency(id) ON DELETE CASCADE`:
  `client`, `opportunity`, `product`, `booking`, `supplier`, `notification`,
  `activity_log`, `commission`, `agency_invite`, plus the denormalized `agencyId`
  on `supplier_contract` and `booking_event`.
- **Child tables** inherit tenancy through their parent (no `agencyId` column) and
  cascade-delete with it: `client_contact`, `product_item`, `booking_traveller`,
  `booking_item`, `booking_day`, `payment`, `booking_supplier_ref`,
  `booking_document`, `booking_idempotency`, `supplier_rate`, `portal_session`.
- **`user.agencyId` is nullable** — NULL identifies the platform super-admin
  (vendor), who lives above all tenants (`isPlatformAdmin`).
- **Uniqueness is per-agency, not global**: `product` and `booking` references are
  enforced by composite unique constraints (`product_agency_reference_unique`,
  `booking_agency_reference_unique`); `supplier` names by
  `supplier_agency_name_unique`. Composite `(agencyId, …)` indexes back the
  tenant-scoped list/filter/order queries.

**Enforcement.** Server-side, `requireAgencyUser()` in `src/lib/permissions.ts`
resolves the session, guarantees a non-null `agencyId`, and blocks suspended
agencies / lapsed subscriptions; every tenant-scoped query then filters by that
`agencyId` (see `src/lib/queries.ts`). The platform admin can "view as" an agency
or a specific user via the `platform_view_agency` / `platform_view_user` cookies.
Within an agency, `FULL_VISIBILITY_ROLES` (`admin`, `manager`, `finance`,
`support`) see all agency data while `agent` sees only their own work
(`seesAllData()` in `src/lib/domain.ts`).

## Where the chain is aspirational

Three links are not yet first-class domain entities — they're the bridge to the
[planned modules](roadmap.md#planned-modules):

- **Invoice** — today an on-demand PDF; the Accounting module turns it into a
  numbered, ledgered record.
- **Accounting** — only the two-ledger `commission` exists; no general ledger.
- **Feedback** — not modelled; "Travel completed → request review" is an unbuilt
  [automation trigger](business-rules.md#automation-triggers).

See the [entity standard](database.md#entity-standard) for the baseline fields
every one of these should carry. Note the two open gaps recorded there: there is
**no `deletedAt` soft-delete column** anywhere (deletes are currently real), and a
human-facing `reference` exists only on `booking` and `product`.
