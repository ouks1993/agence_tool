# Database

Schema lives in `src/lib/schema.ts`. PostgreSQL (Neon) + Drizzle ORM. Tenancy
column shown where present; see [architecture.md](architecture.md#multi-tenancy)
and [security.md](security.md) for how scoping is enforced.

## Entity standard

Every business entity should carry this baseline. It operationalizes the
[never rules](business-rules.md#never-rules-hard-constraints) (one source of
truth, no hard delete, no cross-tenant exposure) at the schema level.

| Field | Purpose | Current state |
|---|---|---|
| **UUID** | Primary key, randomly generated (non-Better-Auth IDs) | ✅ convention in place |
| **Reference** | Human-facing id unique per agency (`BKG-…`, `PRD-…`) | ⚠️ only `booking` + `product` today |
| **createdAt** | Creation timestamp | ✅ widespread |
| **updatedAt** | Last-modified timestamp | ⚠️ on roots, missing on some children |
| **createdBy** | `createdById` → user | ✅ on main entities |
| **agencyId** | Tenant scope (root) or inherited (child) | ✅ enforced everywhere |
| **Status** | Lifecycle/state enum | ⚠️ per-entity, not universal |
| **Activity log** | Audit trail of changes | ⚠️ shared `activity_log` table, not wired for every entity |
| **Soft delete** | `deletedAt` — never hard delete | ❌ **no soft-delete column exists yet** |
| **Notes** | Free-form internal notes | ⚠️ only some entities |

> **Gap to close:** soft delete is **not implemented** — there is no `deletedAt`
> anywhere, so the "never hard delete" rule is currently aspirational. Adding a
> nullable `deletedAt` + filtering it out of reads (and a `reference` on the
> remaining entities) would need a migration. Until then, deletes are real.

## Tables

| Table | Tenancy | Notes |
|---|---|---|
| `agency` | (root) | name, slug, status (active/suspended); **Stripe billing**: stripeCustomerId, stripeSubscriptionId, subscriptionStatus, priceId, currentPeriodEnd, trialEndsAt; **Connect**: stripeConnectAccountId, stripeConnectOnboarded; `onboardingDismissedAt` (getting-started card) |
| `agency_invite` | agencyId | email, role, token, status, expiresAt |
| `user` | agencyId (nullable) | + `isPlatformAdmin`, `role`, `active`, `locale`, `commissionRatePercent` (Better Auth) |
| `session`, `account`, `verification` | via user | Better Auth |
| `portal_session` | via client | passwordless client portal sessions; token + expiresAt |
| `client` | agencyId | + `client_contact` (child); `source` (lead-source code), `industry` (code), country stored as canonical ISO name |
| `opportunity` | agencyId | pipeline stage, value, currency; `travel_purpose` code; `lost_reason` code |
| `product` | agencyId | proposal; ref unique per agency; + `product_item` (child; `supplierId` FK optional); **e-sign**: shareToken (unique), acceptedAt/declinedAt, signerName/Email, signatureData, signerIp/UserAgent |
| `booking` | agencyId | ref unique per agency; shareToken; `travel_purpose` + `trip_type` codes |
| `booking_traveller` (+ `title`, `gender` codes), `booking_item` (+ `supplierId` FK), `payment`, `booking_day` | via booking | children; `booking_traveller` carries `email` + `phone` (required by supplier APIs for the lead passenger) |
| `booking_supplier_ref` | via booking + booking_item | structured supplier confirmation: `providerId`, `confirmationNumber`, `pnr`, `supplierOrderId`, `rawPayload`; replaces untyped JSONB in `booking_item.details` |
| `booking_event` | bookingId + agencyId | append-only event log (audit + analytics); stable `event` codes: `search_initiated`, `offer_selected`, `price_validated`, `price_changed`, `booking_submitted`, `booking_confirmed`, `booking_failed`, `booking_cancelled`, `payment_started`, `payment_completed` |
| `booking_document` | via booking (+ optional booking_item) | documents: `type` (voucher/ticket/invoice/itinerary/receipt), `url` (Vercel Blob), `rawData` (supplier payload for re-generation) |
| `booking_idempotency` | via booking (+ optional booking_item) | idempotency key registry; key = sha256(bookingId+itemId+offerId); prevents duplicate supplier orders on retry; `expiresAt` (24 h TTL) |
| `notification` | agencyId | comms log |
| `activity_log` | agencyId | audit trail |
| `supplier` | agencyId | managed supplier directory (hotels, airlines, DMC, etc.) |
| `supplier_contract` | agencyId | commission basis/rate, validity dates, file URL |
| `supplier_rate` | via contract | structured per-product rates within a contract |
| `commission` | agencyId | earnings ledger: supplier→agency and agency→agent; bookingId, supplierId, agentUserId, basis, rate, amount, status |
| `hotel_content` | (global) | Hotelbeds content cache (photos, facilities, coords) — shared reference data, **not** tenant-scoped; PK is the Hotelbeds hotel code |

## ID convention

All ID columns **not** related to Better Auth use UUIDs, randomly generated. See
[coding-standards.md](coding-standards.md).

## Migrations

| Migration | What it adds |
|---|---|
| `0006` | Tenancy + backfill (`agencyId` on all tables) |
| `0007` | `agency_invite` table |
| `0008` | `user.locale` |
| `0009` | Agency Stripe billing columns |
| `0010` | Product e-signature columns |
| `0011` | `hotel_content` cache |
| `0012` | Stripe Connect columns on `agency` |
| `0013` | `portal_session` table |
| `0014` | `supplier`, `supplier_contract`, `supplier_rate` tables; `supplierId` FK on `booking_item` + `product_item` |
| `0015` | `commission` table; `user.commissionRatePercent` |
| `0016` | `agency.onboardingDismissedAt` |
| `0017` | Controlled-vocab columns: `client.industry`, `opportunity.travel_purpose`, `booking.travel_purpose`/`trip_type`, `booking_traveller.title`/`gender` (all nullable, additive) |
| `0018` | (see existing) |
| `0019` | Sprint 1 booking architecture: `booking_supplier_ref`, `booking_event`, `booking_document`, `booking_idempotency` tables; `booking_traveller.email` + `.phone` columns |

> Migrations `0000`–`0005` predate the multi-tenant rework (the pre-tenancy base
> schema) and are not itemized here.

## Workflow

```
db:generate   →   db:migrate     # NEVER db:push
```

Run on prod after deploy: `POSTGRES_URL=<prod-url> npx drizzle-kit migrate`.
Branches: dev `ep-wandering-sunset-aitlty78` · prod `ep-misty-thunder-aixz34vy`.
Full setup in [development-guide.md](development-guide.md).
