# Database schema

← Back to [Atlas index](../../atlas.md)

`src/lib/schema.ts`. Tenant column shown where present.

| Table | Tenancy | Notes |
|---|---|---|
| `agency` | (root) | name, slug, status (active/suspended); **Stripe billing**: stripeCustomerId, stripeSubscriptionId, subscriptionStatus, priceId, currentPeriodEnd, trialEndsAt |
| `agency_invite` | agencyId | email, role, token, status, expiresAt |
| `user` | agencyId (nullable) | + `isPlatformAdmin`, `role`, `active`, `locale` (Better Auth) |
| `session`, `account`, `verification` | via user | Better Auth |
| `client` | agencyId | + `client_contact` (child) |
| `opportunity` | agencyId | pipeline stage, value, currency |
| `product` | agencyId | proposal; ref unique per agency; + `product_item` (child); **e-sign**: shareToken (unique), acceptedAt/declinedAt, signerName/Email, signatureData, signerIp/UserAgent |
| `booking` | agencyId | ref unique per agency; shareToken |
| `booking_traveller`, `booking_item`, `payment`, `booking_day` | via booking | children |
| `notification` | agencyId | comms log |
| `activity_log` | agencyId | audit trail |
| `hotel_content` | (global) | Hotelbeds content cache (photos, facilities, coords) — shared reference data, **not** tenant-scoped; PK is the Hotelbeds hotel code |

**Migrations** (`drizzle/`): `0006` tenancy + backfill, `0007` agency_invite,
`0008` user.locale, `0009` agency Stripe billing columns, `0010` product
e-signature columns, `0011` hotel_content cache. Workflow: `db:generate` →
`db:migrate` (**never** `db:push`).
