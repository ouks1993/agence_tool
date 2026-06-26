# Key modules

← Back to [Atlas index](../../atlas.md)

**`src/lib/`**
- `domain.ts` — roles, capabilities, enums (statuses, stages, item types,
  currencies), `roleHome`, status/role metadata.
- `permissions.ts` — auth guards + impersonation resolution.
- `auth.ts` / `auth-client.ts` — Better Auth config + client.
- `invites.ts` — create/find/accept invite tokens (7-day TTL).
- `queries.ts` — shared agency-scoped pickers.
- `activity.ts` — `logActivity` (agency-scoped audit).
- `db.ts` (validates env via `getServerEnv`), `schema.ts`, `env.ts`, `config.ts`,
  `format.ts`, `utils.ts`, `itinerary.ts`, `storage.ts`.
- `notifications/email.ts` (Resend adapter) + `notifications/templates.ts` (HTML).
- `billing/stripe.ts` — SaaS subscriptions, checkout, portal, **manual webhook
  signature verification** (distinct from `payments/stripe.ts` = traveler payments).
- `suppliers/` — `index.ts` (per-vertical `getFlightSupplier`/`getHotelSupplier` +
  `safeSearch`), `duffel.ts` (flights + places autocomplete), `hotelbeds.ts`
  (availability + content: thumbnails, room/hotel type, facilities, room photos,
  per-room rates, occupancy/child-age pricing, content list/page fetch),
  `content-cache.ts` (DB-backed hotel-content cache: cache-first reads, self-heal,
  `syncDestinationContent`), `amadeus.ts` (legacy), `mock.ts`, `types.ts`.
- `documents/proposal-pdf.tsx` + `proposal-data.ts` — proposal PDF rendering.

**`src/lib/actions/`** (server actions, all agency-scoped):
`clients`, `opportunities`, `products`, `proposals-public` (token-authed accept/
decline), `bookings`, `payments`, `notifications`, `team`, `invites`, `platform`,
`billing`, `settings`, `search` (flights/hotels + airport/destination autocomplete
+ hotel details). Prod-safety guard for destructive scripts: `scripts/guard.ts`.

**`src/i18n/`** — `config.ts` (locales, metadata, dir), `request.ts` (next-intl
request config reading the `locale` cookie). Messages: `messages/{en,fr,ar}.json`.

**`src/components/`** — `app/` (shell, page-header, stat-card, status-badge),
`charts/` (BarInsight/DonutInsight/AreaInsight), `settings/`, `team/`,
`platform/`, `auth/`, `bookings/`, `clients/`, `products/` (incl. proposal
share/sign), `opportunities/`, `billing/`, `search/` (airport + hotel-destination
autocomplete, hotel details dialog), `documents/`, `ui/` (shadcn).
