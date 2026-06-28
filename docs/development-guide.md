# Development Guide

## Setup

```bash
npm install --legacy-peer-deps    # better-auth peer range
npm run dev                       # http://localhost:3000
npm run check                     # lint + typecheck
npm run build:ci                  # next build
```

After completing any change, run `npm run check` and `npm run build:ci` to verify
code quality (lint, typecheck, build). See [coding-standards.md](coding-standards.md).

## Environment (`.env`)

**Required:** `POSTGRES_URL`, `BETTER_AUTH_SECRET`.

**Optional** (all integrations degrade gracefully to sample/logged behaviour when
unset — see [api-integrations.md](api-integrations.md)):

- `OPENROUTER_API_KEY` — AI features
- `BLOB_READ_WRITE_TOKEN` — uploads
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY` / `EMAIL_FROM` — email
- `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` — billing
- `STRIPE_CONNECT_WEBHOOK_SECRET` / `STRIPE_PLATFORM_FEE_PERCENT` — Connect payments
- `DUFFEL_API_TOKEN` — flights
- `HOTELBEDS_API_KEY` / `HOTELBEDS_SECRET` — hotels
- `PROTECTED_DB_HOSTS` — makes destructive scripts refuse a prod DB (override with
  `ALLOW_PROD=1`). See [security.md](security.md).

## Database

- Branch: prod `ep-misty-thunder-aixz34vy` (currently single branch — dev branch was removed; create a child branch in Neon for local dev).
- After schema changes: `db:generate` → `db:migrate` (**never** `db:push`).
  `db:studio` to browse. See [database.md](database.md).
- **Always run migrations on prod after deploy:**
  `POSTGRES_URL=<prod-url> npx drizzle-kit migrate`.

## Maintenance scripts

```bash
# Promote an existing account to the platform super-admin
npx tsx --env-file=.env scripts/make-platform-admin.ts <email>

# Seed / reset the Demo Agency (idempotent — wipes its data, keeps users, reseeds)
npx tsx --env-file=.env scripts/seed-demo-data.ts

# Cross-tenant isolation test (seeds 2 agencies, asserts no leak, cleans up)
npx tsx --env-file=.env scripts/test-tenant-isolation.ts

# Normalize legacy free-text country values to canonical ISO names
npx tsx --env-file=.env scripts/backfill-countries.ts

# Sync Hotelbeds hotel content (photos/facilities/coords) into the cache table
npx tsx --env-file=.env scripts/sync-hotel-content.ts            # curated destinations
npx tsx --env-file=.env scripts/sync-hotel-content.ts BCN MAD    # specific codes
```

## Testing

Use the project's testing tools/scripts (e.g. `test-tenant-isolation.ts`) to
verify changes — never assume changes work. If no tooling covers a change, ask
whether testing should be skipped. See [coding-standards.md](coding-standards.md).
