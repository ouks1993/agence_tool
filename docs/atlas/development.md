# Local development

← Back to [Atlas index](../../atlas.md)

```bash
npm install --legacy-peer-deps    # better-auth peer range
npm run dev                       # http://localhost:3000
npm run check                     # lint + typecheck
npm run build:ci                  # next build
```

**Env (`.env`):** required `POSTGRES_URL`, `BETTER_AUTH_SECRET`. Optional
`OPENROUTER_API_KEY` (AI chat), `BLOB_READ_WRITE_TOKEN` (uploads),
`GOOGLE_CLIENT_ID`/`SECRET`, `NEXT_PUBLIC_APP_URL`,
`RESEND_API_KEY`/`EMAIL_FROM` (email),
`STRIPE_SECRET_KEY`/`STRIPE_PRICE_ID`/`STRIPE_WEBHOOK_SECRET` (billing),
`DUFFEL_API_TOKEN` (flights), `HOTELBEDS_API_KEY`/`HOTELBEDS_SECRET` (hotels).
All integrations degrade gracefully to sample/logged behaviour when unset.
`PROTECTED_DB_HOSTS` makes destructive scripts refuse a prod DB (override `ALLOW_PROD=1`).

**Database:** `db:generate` (after schema edits) → `db:migrate`. `db:studio` to browse.

---

## Scripts

```bash
# Promote an existing account to the platform super-admin
npx tsx --env-file=.env scripts/make-platform-admin.ts <email>

# Seed / reset the Demo Agency (idempotent — wipes its data, keeps users, reseeds)
npx tsx --env-file=.env scripts/seed-demo-data.ts

# Cross-tenant isolation test (seeds 2 agencies, asserts no leak, cleans up)
npx tsx --env-file=.env scripts/test-tenant-isolation.ts

# Sync Hotelbeds hotel content (photos/facilities/coords) into the cache table.
# Run occasionally (e.g. weekly); serves real photos quota-free thereafter.
npx tsx --env-file=.env scripts/sync-hotel-content.ts            # curated destinations
npx tsx --env-file=.env scripts/sync-hotel-content.ts BCN MAD    # specific codes
```
