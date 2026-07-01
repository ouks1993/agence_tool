# Deployment

Atlas ships as a single Next.js app to **Vercel**, backed by a **Neon** Postgres
database. Deploys are Git-driven: pushing to `main` triggers a production build
that runs pending Drizzle migrations and then compiles the app. This document
covers the Vercel pipeline, the dev-vs-prod database split, the full production
environment, migration-on-deploy behaviour, and the demo/seed accounts.

## Stack at a glance

| Piece | Value | Source |
|---|---|---|
| Framework | Next.js `16.1.6` (App Router, Turbopack dev) | `package.json` |
| Runtime | React `19.2.4` / Node.js 20+ | `package.json`, `scripts/setup.ts` |
| ORM / migrations | Drizzle ORM `^0.44.7` + drizzle-kit `^0.31.10` | `package.json` |
| DB driver | `postgres` (postgres-js) `^3.4.9` | `src/lib/db.ts` |
| Host | Vercel (framework: `nextjs`) | `vercel.json` |
| Database | Neon Postgres | `docs/database.md` |

## Vercel

- Project `atlasproject/agence_tool`, connected to GitHub.
- **Auto-deploy:** `git push origin main` → builds & ships production.
- **Manual:** `npx vercel deploy --prod --yes`.
- Configuration lives in `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "npm run db:migrate && npm run build:ci",
  "installCommand": "npm install --legacy-peer-deps",
  "crons": [{ "path": "/api/cron/cleanup", "schedule": "0 3 * * *" }]
}
```

- `installCommand` uses `--legacy-peer-deps` (also pinned via `.npmrc` →
  `legacy-peer-deps=true`) so React 19 peer-dependency mismatches in the
  dependency tree don't fail the install.
- Migrations run automatically on every deploy — no manual step needed for schema
  changes (see [Migrations on prod](#migrations-on-prod)).
- **Cron:** `crons` schedules a daily `GET /api/cron/cleanup` at 03:00 UTC — see
  [Scheduled cleanup](#scheduled-cleanup) below.

### Build pipeline

The Vercel `buildCommand` chains two npm scripts (from `package.json`):

| Step | Script | Command | Purpose |
|---|---|---|---|
| 1 | `db:migrate` | `drizzle-kit migrate` | Apply pending migrations to the target DB |
| 2 | `build:ci` | `next build` | Compile the production bundle |

Because the two run in sequence, a failed migration aborts the build before
`next build` — the database and the deployed code never drift apart. Note that
`build:ci` is deliberately migration-free; the top-level `build` script
(`pnpm run db:migrate && next build`) also migrates and is used for local
production builds. Only `build:ci` is invoked on Vercel, with `db:migrate`
prepended explicitly by `vercel.json`.

### next.config.ts

Production behaviour that ships with the build (`next.config.ts`):

- **Image optimization** — remote patterns allow-list: `lh3.googleusercontent.com`,
  `avatars.githubusercontent.com`, `*.public.blob.vercel-storage.com`,
  `photos.hotelbeds.com` (live hotel/room photos), and `picsum.photos` /
  `fastly.picsum.photos` (sample fallbacks).
- **Compression** — `compress: true`.
- **URL canonicalization** — `rewrites()` serve `/proposals*` from `/products*`
  and `/sourcing/hotels*` from `/hotels*`; `redirects()` send old paths to the
  canonical ones (`/products*` → `/proposals*` permanent; `/search`,
  `/hotels*`, `/operations` → new paths, temporary).
- **Security headers** applied to all routes: `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `X-XSS-Protection: 1; mode=block`, and
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **next-intl** — the config is wrapped with `withNextIntl()` for i18n
  (English / Français / العربية).

## Vercel environment

Environment variables are validated at runtime by a Zod schema in
`src/lib/env.ts` (`getServerEnv()` / `getClientEnv()`). `POSTGRES_URL` and
`BETTER_AUTH_SECRET` are the only hard requirements; everything else is optional
and the app degrades gracefully when a key is absent (`checkEnv()` logs a warning
in development for each missing optional group).

### Required

| Variable | Validation | Purpose |
|---|---|---|
| `POSTGRES_URL` | must be a valid URL | Neon Postgres connection string (consumed by `src/lib/db.ts` and `drizzle.config.ts`) |
| `BETTER_AUTH_SECRET` | min 32 chars | Better Auth session/cookie signing secret |

### App / auth

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Public base URL (client-exposed) |
| `BETTER_AUTH_URL` | — | Base URL Better Auth uses for callbacks; set to the production origin |
| `NODE_ENV` | `development` | `development` \| `production` \| `test` |
| `GOOGLE_CLIENT_ID` | optional | Google OAuth — social login disabled when unset |
| `GOOGLE_CLIENT_SECRET` | optional | Google OAuth secret |

### Database safety

| Variable | Purpose |
|---|---|
| `PROTECTED_DB_HOSTS` | Comma-separated host substrings that destructive scripts refuse to touch. Set to `ep-misty-thunder-aixz34vy` (prod host) in Vercel; never in local `.env`. |
| `CRON_SECRET` | Optional bearer secret Vercel injects into the `Authorization` header when calling scheduled cron routes. Without it, `GET /api/cron/cleanup` returns `503` (see below). |

### Integrations (optional)

Consumed across `src/lib/*` and documented in
[api-integrations.md](api-integrations.md). Each group no-ops or falls back to
sample data when unset.

| Variable | Default | Feature |
|---|---|---|
| `OPENROUTER_API_KEY` | optional | AI chat / assistant (disabled when unset) |
| `OPENROUTER_MODEL` | `openai/gpt-5-mini` | Default AI model |
| `BLOB_READ_WRITE_TOKEN` | optional | Vercel Blob file storage (falls back to local storage) |
| `RESEND_API_KEY` | optional | Transactional email via Resend |
| `EMAIL_FROM` | optional | Sender address; without `RESEND_API_KEY` + `EMAIL_FROM`, emails are logged to the console |
| `STRIPE_SECRET_KEY` | optional | SaaS subscription billing (vendor bills agencies) |
| `STRIPE_WEBHOOK_SECRET` | optional | Billing webhook signature verification |
| `STRIPE_PRICE_ID` | optional | Subscription price |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | optional | Stripe Connect (traveler → agency) webhook secret |
| `STRIPE_PLATFORM_FEE_PERCENT` | `5` | Platform fee percentage on Connect payments |
| `DUFFEL_API_TOKEN` | optional | Live flight search (sample data when unset) |
| `DUFFEL_VERSION` | optional | Duffel API version header |
| `HOTELBEDS_API_KEY` | optional | Live hotel search (sample data when unset) |
| `HOTELBEDS_SECRET` | optional | Hotelbeds signature secret |
| `HOTELBEDS_HOSTNAME` | optional | Hotelbeds API host |
| `AMADEUS_CLIENT_ID` | optional | Legacy flights provider (Amadeus self-service decommissioned 2026-07-17) |
| `AMADEUS_CLIENT_SECRET` | optional | Legacy Amadeus secret |
| `AMADEUS_HOSTNAME` | optional | Legacy Amadeus host |

> **Note:** `env.example` at the repo root is a stale starter-kit template (it
> references Polar, SendGrid, and Amadeus-only setup). The authoritative list of
> variables the app actually reads is the Zod schema in `src/lib/env.ts` — use
> the tables above, not `env.example`, when provisioning production.

## Databases (Neon)

Atlas uses two Neon branches off the same project — one for local/dev work and
one for production. The dev database is treated as scratch; production is
guarded so a stray local script can never wipe it.

| Branch | Neon endpoint | Used by |
|---|---|---|
| dev | `ep-wandering-sunset-aitlty78` | Local development, throwaway data |
| prod | `ep-misty-thunder-aixz34vy` | Vercel production deploy |

Each environment points `POSTGRES_URL` at its own branch. The production host
substring is also set as `PROTECTED_DB_HOSTS` in Vercel so the destructive-script
guard (below) refuses to run against it.

The DB connection is created in `src/lib/db.ts` via `drizzle(postgres(POSTGRES_URL))`
using the postgres-js driver, with the schema imported from `src/lib/schema.ts`.
See [database.md](database.md) for the schema and tenancy model.

## Migrations on prod

Migrations run automatically as part of every Vercel deploy (`npm run db:migrate`
— i.e. `drizzle-kit migrate` — is prepended to the build command). No manual step
is required. Migration SQL files live in `drizzle/` and are generated from
`src/lib/schema.ts` via `drizzle-kit generate` (per `drizzle.config.ts`, dialect
`postgresql`, output `./drizzle`).

Per project rules, schema changes must go through **generate → migrate**; never
`drizzle-kit push` against a shared/prod database.

```bash
# Local workflow after editing src/lib/schema.ts
pnpm db:generate      # create a new migration in drizzle/
pnpm db:migrate       # apply it to the DB in POSTGRES_URL
```

For a one-off manual run (e.g. emergency hotfix outside a deploy):

```bash
POSTGRES_URL=<prod-url> npx drizzle-kit migrate
```

### Destructive-script guard

Seeding, reset, and isolation-test scripts call
`assertSafeDestructiveTarget()` from `scripts/guard.ts`. A target is
**protected** — and the script refuses to run — when either:

- `NODE_ENV === "production"`, **or**
- the `POSTGRES_URL` host matches any entry in `PROTECTED_DB_HOSTS`
  (comma-separated substrings).

Override an intentional run with `ALLOW_PROD=1`. This is why
`PROTECTED_DB_HOSTS=ep-misty-thunder-aixz34vy` is set in Vercel and must **not**
be set in local `.env`. See [security.md](security.md) and
[database.md](database.md).

## Scheduled cleanup

`GET /api/cron/cleanup` (`src/app/api/cron/cleanup/route.ts`, `runtime = "nodejs"`)
runs daily at 03:00 UTC via the `crons` entry in `vercel.json`. It deletes rows
that grow unbounded and have no value once expired: `booking_idempotency` rows
past `expiresAt`, `portal_session` rows past `expiresAt`, and `agency_invite`
rows that are still `pending` **and** expired (accepted/revoked invites are left
as audit history). Auth is a shared-secret bearer check against `CRON_SECRET`
(Vercel injects `Authorization: Bearer ${CRON_SECRET}` automatically for cron
invocations): the route returns `503` when `CRON_SECRET` is unset and `401` on a
missing/incorrect bearer token.

## Deploy checklist

1. Confirm required env vars (`POSTGRES_URL`, `BETTER_AUTH_SECRET`) and any
   integration keys are set in the Vercel project.
2. Commit schema changes with their generated `drizzle/*.sql` migration.
3. `git push origin main` (or `npx vercel deploy --prod --yes`).
4. The build runs `drizzle-kit migrate` then `next build`; a migration failure
   aborts the deploy.
5. Verify the live site and, if needed, reseed the Demo Agency (below).

## Demo accounts

Throwaway accounts on the **Demo Agency** (`agencyId`
`00000000-0000-0000-0000-000000000001`), all on the live site.

| Role | Email | Password |
|---|---|---|
| Platform admin (vendor) | `ouksili.abdelmalek@gmail.com` | `Atlas!2026` |
| Manager | `yasmine@agence.test` | `Agency!2026` |
| Finance | `finance@demo.test` | `Finance!2026` |
| Support | `support@demo.test` | `Support!2026` |
| Agent | `karim@demo.test` | `Agent!2026` |
| Agent | `lina@demo.test` | `Agent!2026` |
| Agent | `omar@demo.test` | `Agent!2026` |
| Agent | `yacine@demo.test` | `Agent!2026` |
| Agent | `nour@demo.test` | `Agent!2026` |

The platform admin is provisioned by promoting an existing account with
`scripts/make-platform-admin.ts <email>` (sets `isPlatformAdmin = true`,
`agencyId = null`, so they route to `/platform`). The agent accounts and their
`Agent!2026` password are (re)created by the seed script; the manager, finance,
and support accounts are pre-existing users on the Demo Agency that the seed
keeps intact.

> 🔒 **DEMO CREDENTIALS ONLY** — rotate or delete before any real production use.
> These live passwords are checked into the repo; treat as a known risk (see
> [security.md](security.md)).

**Suggested demo flow:** sign in as vendor → `/platform` → View as Demo Agency →
manager dashboard → switch to finance/support/agent views → Settings → switch to
Français or العربية.

### Reseeding demo data

`scripts/seed-demo-data.ts` rebuilds a rich, realistic dataset for the Demo
Agency. It is **idempotent**: it wipes the Demo Agency's business data (clients,
suppliers, opportunities, products, bookings + children, payments, commissions,
notifications, activity) but **keeps the agency and its users**, then reseeds.
All amounts are denominated in DZD (Algerian Dinar). The seed is gated by the
destructive-script guard, so it refuses to run against the protected prod host
without `ALLOW_PROD=1`.

```bash
npx tsx --env-file=.env scripts/seed-demo-data.ts
```
