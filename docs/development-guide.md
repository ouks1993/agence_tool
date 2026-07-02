# Development Guide

This guide takes you from a clean checkout to a running local Atlas instance, then
documents every package script, the Drizzle database workflow, and the maintenance /
seed scripts. Every command below is verified against `package.json`, `drizzle.config.ts`,
`src/lib/env.ts`, and the files under `scripts/`.

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js | v20+ recommended. `scripts/setup.ts` enforces a v20 minimum; the repo ships a `.nvmrc` pinned to `20`. |
| Package manager | `pnpm` is the canonical manager (the repo tracks `pnpm-lock.yaml`, and `build` shells out to `pnpm run db:migrate`). `npm`/`yarn` also work — substitute `npm run <script>`. |
| PostgreSQL | A reachable Postgres instance (local, Neon, or Vercel Postgres). Its connection string goes in `POSTGRES_URL`. |

## Setup

From a clean checkout:

```bash
pnpm install                      # installs deps from pnpm-lock.yaml
cp env.example .env               # then fill in POSTGRES_URL + BETTER_AUTH_SECRET
pnpm db:migrate                   # apply existing migrations to your database
pnpm dev                          # http://localhost:3000 (Next.js + Turbopack)
```

`pnpm dev` runs `next dev --turbopack`. Open [http://localhost:3000](http://localhost:3000).

Alternatively, run the interactive wizard, which copies `env.example` → `.env`, checks
Node/env vars, and offers to run migrations:

```bash
pnpm setup                        # npx tsx scripts/setup.ts
```

After completing any change, run the quality gates:

```bash
pnpm check                        # eslint . && tsc --noEmit
pnpm build:ci                     # next build (no migrations)
```

See [coding-standards.md](coding-standards.md) for lint/typecheck conventions.

## Package scripts

Every script in `package.json`, with exactly what it does:

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev --turbopack` | Start the dev server with Turbopack at `:3000`. |
| `build` | `pnpm run db:migrate && next build` | **Production build — runs migrations first**, then `next build`. |
| `build:ci` | `next build` | Build **without** migrations (use in CI where migrations run as a separate step). |
| `start` | `next start` | Serve the production build. |
| `lint` | `eslint .` | Lint the repository. |
| `typecheck` | `tsc --noEmit` | Type-check without emitting output. |
| `check` | `pnpm lint && pnpm typecheck` | Combined lint + typecheck gate. |
| `format` | `prettier --write .` | Format all files in place. |
| `format:check` | `prettier --check .` | Verify formatting without writing. |
| `setup` | `npx tsx scripts/setup.ts` | Interactive setup wizard (env file + optional migration). |
| `env:check` | `node -e "…checkEnv()"` | Best-effort env sanity check; run under `tsx` for reliability (see below). |
| `db:generate` | `drizzle-kit generate` | Generate a new SQL migration from schema changes. |
| `db:migrate` | `drizzle-kit migrate` | Apply pending migrations to `POSTGRES_URL`. |
| `db:push` | `drizzle-kit push` | Push schema directly — **do not use** (see Database rules). |
| `db:studio` | `drizzle-kit studio` | Open Drizzle Studio to browse the DB. |
| `db:dev` | `drizzle-kit push` | Alias of `db:push` — same caveat, avoid. |
| `db:reset` | `drizzle-kit drop && drizzle-kit push` | Drop + re-push. Destructive; avoid on any shared DB. |

The `env:check` script tries to `require` a `.ts` file directly under Node, which will fail
in most setups. The required-env fail-fast at runtime is handled separately by `src/lib/db.ts`,
which calls `getServerEnv()` (the Zod schema) at import time — `checkEnv()` itself is not wired
into the running app. To run the `checkEnv()` validator manually:

```bash
npx tsx -e "import { checkEnv } from './src/lib/env'; checkEnv();"
```

## Environment

Copy `env.example` to `.env` and fill it in. Environment variables are validated by
`src/lib/env.ts` (Zod schemas). `src/lib/db.ts` calls `getServerEnv()` at import time, so a
missing or malformed `POSTGRES_URL`/`BETTER_AUTH_SECRET` fails fast with a clear message
instead of a raw driver error.

> Note: `env.example` still lists some legacy/alternate providers (Amadeus, SendGrid, Polar)
> that predate the current stack. The variables the running code actually reads are defined
> in `src/lib/env.ts` and documented below; that schema is the source of truth.

### Required

| Variable | Validation | Purpose |
|---|---|---|
| `POSTGRES_URL` | must be a valid URL | Postgres connection string (Drizzle + `postgres-js`). |
| `BETTER_AUTH_SECRET` | ≥ 32 characters | Better Auth signing secret. Generate one per the Better Auth docs. |

`checkEnv()` throws if either of these is unset. All other variables are optional and the
app degrades gracefully when they are missing (see the per-variable behaviour below and
[api-integrations.md](api-integrations.md)).

### Optional

| Variable | Default | When unset |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Client-exposed base URL (the only `NEXT_PUBLIC_*` var). |
| `NODE_ENV` | `development` | One of `development` / `production` / `test`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | Google social login is disabled. |
| `OPENROUTER_API_KEY` | — | AI chat / assistant features do not work. |
| `OPENROUTER_MODEL` | `openai/gpt-5-mini` | Overrides the default AI model. |
| `BLOB_READ_WRITE_TOKEN` | — | File uploads fall back to local storage instead of Vercel Blob. |
| `RESEND_API_KEY` / `EMAIL_FROM` | — | Emails are logged to the console instead of sent. |
| `STRIPE_SECRET_KEY` | — | SaaS subscription billing (vendor bills agencies) is disabled. |
| `STRIPE_WEBHOOK_SECRET` | — | Verifies Stripe subscription webhooks. |
| `STRIPE_PRICE_ID` | — | The subscription price used at checkout. |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | — | Verifies Stripe Connect (traveler → agency) webhooks. |
| `STRIPE_PLATFORM_FEE_PERCENT` | `5` | Platform fee percentage taken on Connect payments. |
| `DUFFEL_API_TOKEN` | — | Flight search uses sample data instead of live Duffel results. |
| `DUFFEL_VERSION` | — | Pins the Duffel API version header. |
| `HOTELBEDS_API_KEY` / `HOTELBEDS_SECRET` | — | Hotel search uses sample data instead of live Hotelbeds results. |
| `HOTELBEDS_HOSTNAME` | — | Overrides the Hotelbeds API host. |
| `PROTECTED_DB_HOSTS` | — | Comma-separated host substrings that make destructive scripts refuse to run (see below). |

`AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET` / `AMADEUS_HOSTNAME` remain in the schema as a
**decommissioned** legacy flights provider (Amadeus self-service retires 2026-07-17); Duffel
is the current flights provider. See [api-integrations.md](api-integrations.md).

When `NODE_ENV=development`, `checkEnv()` prints a warning for each unset optional integration
so you can see at a glance what is running on sample/logged behaviour.

## Database

Atlas uses **Drizzle ORM** over `postgres-js`. The schema lives in `src/lib/schema.ts`;
migrations are emitted to `./drizzle` (`drizzle.config.ts`, dialect `postgresql`). The
database connection is created once in `src/lib/db.ts`.

- Branches: dev `ep-wandering-sunset-aitlty78` · prod `ep-misty-thunder-aixz34vy`. See [database.md](database.md).

### Migration workflow (generate → migrate, never push)

1. Edit `src/lib/schema.ts`.
2. `pnpm db:generate` — writes a new timestamped SQL file under `drizzle/`.
3. Review the generated SQL.
4. `pnpm db:migrate` — applies pending migrations to `POSTGRES_URL`.

```bash
pnpm db:generate      # after any schema change
pnpm db:migrate       # apply
pnpm db:studio        # browse the DB
```

> **Never run `db:push` (or `db:dev` / `db:reset`).** Per project rules, all schema changes
> go through `db:generate` → `db:migrate` so migrations stay reviewable and reproducible.
> The `db:push` / `db:dev` / `db:reset` scripts exist from the upstream starter but must not
> be used against any shared database.

For UUID primary keys (all IDs except Better Auth's own tables), use randomly generated
UUIDs. See [database.md](database.md) for the full schema and conventions.

### Migrating production

Migrations do **not** apply themselves in `build:ci`. Always run migrations against prod
after a deploy, pointing `POSTGRES_URL` at the prod branch:

```bash
POSTGRES_URL=<prod-url> npx drizzle-kit migrate
```

(The default `pnpm build` script already runs `db:migrate` before `next build`; `build:ci`
skips it so hosts can run migrations as a discrete step.)

## Maintenance & seed scripts

All scripts live in `scripts/` and are run with `tsx`, loading `.env` via `--env-file`. They
import the app's `db`/`auth`, so `POSTGRES_URL` must point at the intended database.

```bash
# Promote an existing account to the platform super-admin (isPlatformAdmin=true,
# agencyId=null → routed to /platform). The account must already be registered.
npx tsx --env-file=.env scripts/make-platform-admin.ts <email>

# Seed / reset the Demo Agency (idempotent). Wipes the Demo Agency's business data
# (clients, suppliers, opportunities, products, bookings + children, payments,
# commissions, notifications, activity), KEEPS the agency + users, then reseeds a
# large curated set — all amounts in DZD. Requires the Demo Agency (UUID
# 00000000-…-000000000001) and its base users to already exist; it also (re)creates
# five agent logins (karim/lina/omar/yacine/nour @demo.test, password Agent!2026).
npx tsx --env-file=.env scripts/seed-demo-data.ts

# Cross-tenant isolation harness — seeds two agencies, asserts no cross-tenant
# read/leak across root + child tables, then cascades cleanup of both.
npx tsx --env-file=.env scripts/test-tenant-isolation.ts

# Normalize legacy free-text country values on client/supplier rows to canonical
# ISO names (e.g. "USA" → "United States"). Idempotent; unmapped values are logged.
npx tsx --env-file=.env scripts/backfill-countries.ts

# Sync Hotelbeds hotel content (photos/facilities/coords) into the hotel_content
# cache table. Requires HOTELBEDS_API_KEY / HOTELBEDS_SECRET.
npx tsx --env-file=.env scripts/sync-hotel-content.ts            # curated destinations
npx tsx --env-file=.env scripts/sync-hotel-content.ts BCN MAD    # specific codes
SYNC_MAX=200 npx tsx --env-file=.env scripts/sync-hotel-content.ts BCN   # cap per dest (default 80)
```

### Destructive-script safety guard

The seed, isolation-test, and country-backfill scripts call
`assertSafeDestructiveTarget()` (`scripts/guard.ts`) before touching data. A target is
**protected** — and the script refuses to run — when either:

- `NODE_ENV === "production"`, or
- the `POSTGRES_URL` host matches any comma-separated substring in `PROTECTED_DB_HOSTS`
  (set this in prod/Vercel, never in local `.env`).

Override for an intentional prod run with `ALLOW_PROD=1`:

```bash
ALLOW_PROD=1 POSTGRES_URL=<prod-url> npx tsx scripts/backfill-countries.ts
```

See [security.md](security.md).

## Testing

**Unit tests — Vitest.** The unit-test runner is Vitest (`vitest@^3.2.6`, pinned to
the 3.x line — vitest 4 pulls vite 8, whose transitive deps currently fail to
install; `@vitest/coverage-v8` is available). Config lives in `vitest.config.ts`
(node environment, `@` → `./src` alias, includes `src/**/*.test.ts`).

```bash
pnpm test          # vitest run — single pass
pnpm test:watch    # vitest — watch mode
```

Conventions: tests are **colocated** next to the module (`src/lib/analytics.test.ts`),
import `{ describe, it, expect }` explicitly from `"vitest"` (no globals), and cover
**pure modules only** — nothing that imports `src/lib/db.ts` or triggers `env.ts`
validation. Current suite: analytics, payments/summary, reports/period, status-tone,
domain, export/csv, format.

**Integration verification scripts.** The project also ships targeted verification
scripts — most importantly `scripts/test-tenant-isolation.ts`, which seeds two agencies and
asserts that no query, child-row lookup, or reference collides across tenants (then cleans
up). Use these to verify changes; per project rules, never assume a change works, and if no
tooling covers a change, ask whether testing should be skipped. See
[coding-standards.md](coding-standards.md).
