# Routes

← Back to [Atlas index](../../atlas.md)

**Authenticated app** (`(app)/`, gated by `requireAgencyUser`):
`dashboard`, `finance`, `support`, `bookings` (+ `new`, `[id]`, `[id]/edit`,
`[id]/itinerary`), `clients` (+ `new`, `[id]`, `[id]/edit`), `opportunities`
(+ `new`, `[id]`, `[id]/edit`), `products` (+ `new`, `[id]`, `[id]/edit`),
`operations`, `search`, `hotels` (+ `[code]` details), `assistant`, `team`,
`billing` (admin-only), `settings`, `profile`.

**Platform** (`platform/`, gated by `requirePlatformAdmin`): `platform`,
`platform/agencies/new`, `platform/agencies/[id]`.

**Auth** (`(auth)/`): `login`, `register` (invite-only notice),
`forgot-password`, `reset-password`. **Accept invite:** `invite/[token]`.

**Public / docs:** `i/[token]` (shareable itinerary, unauth),
`p/[token]` (public signable proposal) + `p/[token]/pdf`,
`proposal/[id]` (internal preview) + `proposal/[id]/pdf`,
`booking-docs/[id]/voucher`, `booking-docs/[id]/invoice`.

**API:** `api/auth/[...all]` (Better Auth), `api/chat` (AI assistant),
`api/stripe/webhook` (subscription reconciliation, raw-body signature check).
