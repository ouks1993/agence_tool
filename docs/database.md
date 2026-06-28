# Database

Schema lives in `src/lib/schema.ts`. PostgreSQL (Neon) + Drizzle ORM. Tenancy
column shown where present; see [architecture.md](architecture.md#multi-tenancy)
and [security.md](security.md) for how scoping is enforced.

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
| `booking_traveller` (+ `title`, `gender` codes), `booking_item` (+ `supplierId` FK), `payment`, `booking_day` | via booking | children |
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

> Migrations `0000`–`0005` predate the multi-tenant rework (the pre-tenancy base
> schema) and are not itemized here.

## Workflow

```
db:generate   →   db:migrate     # NEVER db:push
```

Run on prod after deploy: `POSTGRES_URL=<prod-url> npx drizzle-kit migrate`.
Branches: dev `ep-dawn-voice-ai8d6q3o` · prod `ep-misty-thunder-aixz34vy`.
Full setup in [development-guide.md](development-guide.md).
