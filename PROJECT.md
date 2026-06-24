# Atlas — Travel Agency SaaS

A multi-tenant SaaS for travel agencies: each agency runs its bookings, clients,
proposals and finance in an isolated workspace, while the vendor manages all
agencies from a platform console. Built on the Agentic Coding Starter Kit.

**Live:** https://agencetool.vercel.app

---

## Tech stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS v4 (CSS-first, `@theme inline`) + shadcn/ui (new-york)
- **Auth:** Better Auth (email/password, invitation-gated signup)
- **DB:** PostgreSQL (Neon) + Drizzle ORM
- **i18n:** next-intl (EN / FR / AR, cookie-based, RTL)
- **Charts:** recharts (tokenized to the design system)
- **AI:** Vercel AI SDK + OpenRouter (assistant — needs `OPENROUTER_API_KEY`)
- **Hosting:** Vercel (GitHub auto-deploy on `main`)

See `DESIGN.md` for the design system and `AGENTS.md`/`CLAUDE.md` for working conventions.

---

## Architecture

### Multi-tenancy
Every business table carries an `agencyId` and **all** queries are scoped by it,
so agencies never see each other's data. References (`BKG-…`, `PRD-…`) are unique
**per agency**. Tenancy is enforced at the data layer and re-verified by a test
harness (`scripts/test-tenant-isolation.ts`).

Tenant-root tables: `agency`, `client`, `opportunity`, `product`, `booking`,
`notification`, `activity_log`, `agency_invite`, plus `user.agencyId`. Child
tables (travellers, items, payments, days, contacts) inherit tenancy through
their parent.

### Roles (RBAC)
Five roles, defined in `src/lib/domain.ts` with capability helpers:

| Role | Sees all agency data | Manages team | Manages payments | Deletes records | Home |
|---|---|---|---|---|---|
| **admin** | ✅ | ✅ | ✅ | ✅ | `/dashboard` |
| **manager** | ✅ | ✅ | ✅ | ✅ | `/dashboard` |
| **finance** | ✅ | — | ✅ | — | `/finance` |
| **support** | ✅ | — | — | — | `/support` |
| **agent** | own work only | — | — | — | `/dashboard` (scoped) |

Helpers: `seesAllData`, `canManageTeam`, `canAssignAdmin`, `canManagePayments`,
`canViewFinance`, `canViewSupport`, `canDeleteRecords`, `roleHome`.

### Auth & onboarding
- **Invitation-only signup**: the Better Auth create hook (`src/lib/auth.ts`)
  rejects any signup without a matching pending invite and stamps `agencyId` +
  role from it. Accept flow lives at `/invite/[token]`.
- Guards (`src/lib/permissions.ts`): `requireUser`, `requireAgencyUser`
  (tenant + suspension lockout), `requireManager`, `requireCapability`,
  `requirePlatformAdmin`.

### Platform (vendor) console — `/platform`
The vendor is a user with `isPlatformAdmin = true` and `agencyId = null`,
sitting above all tenants. From `/platform` they can:
- Create agencies (generates the first-admin invite link)
- Suspend / reactivate agencies (suspended → users locked out)
- **View as agency** (act as agency admin) or **View as user** (act as a
  specific user with *their* role + scoped data) — with an exit banner.

Impersonation is cookie-driven (`platform_view_agency` / `platform_view_user`)
and only takes effect for a platform admin (resolved in `requireUser`).

### Per-role workspaces
- `/dashboard` — agency overview (admin/manager) or "Your work" (agent); manager
  view includes analytics charts (bookings by country, team performance, status,
  monthly trend) + finance KPIs.
- `/finance` — payments / accounts-receivable + revenue, with charts.
- `/support` — action queue (bookings needing attention) + clients + ops.
- `/team`, `/clients`, `/bookings`, `/opportunities`, `/products`, `/operations`,
  `/search`, `/assistant`, `/settings`, `/profile`.

### i18n
- English / French / Arabic, **cookie-based** (no URL-locale routing — routes
  unchanged). Arabic is full **RTL** with **IBM Plex Sans Arabic**.
- Config: `src/i18n/config.ts` + `src/i18n/request.ts`; messages in
  `messages/{en,fr,ar}.json`. Change language in **Settings**.
- Core surfaces (nav, login, dashboard, settings) are translated; deeper pages
  fall back to English. To translate more, add keys to **all three** message
  files and swap strings to `t("…")`.

---

## Local development

```bash
npm install --legacy-peer-deps     # better-auth peer range needs this
npm run dev                        # http://localhost:3000
npm run check                      # lint + typecheck
npm run build:ci                   # next build (no migrate)
```

Required env (`.env`): `POSTGRES_URL`, `BETTER_AUTH_SECRET`. Optional (features
off until set): `OPENROUTER_API_KEY` (AI chat), `BLOB_READ_WRITE_TOKEN`
(uploads), Google OAuth.

### Database
```bash
npm run db:generate   # after editing src/lib/schema.ts
npm run db:migrate    # apply migrations  (NEVER db:push)
npm run db:studio
```
Migrations in `drizzle/`. Notable: `0006` (tenancy + backfill), `0007` (invites),
`0008` (user.locale).

### Scripts
```bash
# Promote an existing account to platform super-admin (vendor)
npx tsx --env-file=.env scripts/make-platform-admin.ts <email>

# Seed / reset the Demo Agency with rich demo data (idempotent)
npx tsx --env-file=.env scripts/seed-demo-data.ts

# Verify cross-tenant isolation (seeds 2 agencies, asserts no leak)
npx tsx --env-file=.env scripts/test-tenant-isolation.ts
```

---

## Deployment

Hosted on **Vercel** (`atlasproject/agence_tool`), connected to GitHub
(`ouks1993/agence_tool`).

- **Auto-deploy:** `git push origin main` builds & ships production.
- **Manual:** `npx vercel deploy --prod --yes`
- Config in `vercel.json` (`buildCommand: npm run build:ci`) + `.npmrc`
  (`legacy-peer-deps=true`).
- Env vars on Vercel: `POSTGRES_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`,
  `BETTER_AUTH_URL` (the last fixes `INVALID_ORIGIN` on the deployed domain).

> ⚠️ Production and local dev currently **share one Neon database**. Split prod
> onto its own Neon branch before onboarding real customers.

---

## Demo

The **Demo Agency** is seeded for customer demos (re-run the seed script to
reset). Accounts (Demo Agency unless noted):

| Role | Email |
|---|---|
| Platform admin (vendor) | `ouksili.abdelmalek@gmail.com` |
| Manager | `yasmine@agence.test` |
| Finance | `finance@demo.test` |
| Support | `support@demo.test` |
| Agents | `karim@demo.test`, `lina@demo.test`, `omar@demo.test` |

> Demo credentials are throwaway and set by the seed/admin scripts — **rotate or
> remove them before any real production use**. (Agent accounts use the seed
> default; reset any password via the scripts above.)

**Suggested demo flow:** sign in as the vendor → `/platform` → create an agency
(or *View as* Demo Agency) → tour the manager dashboard charts → switch logins to
show the finance, support and agent views → open Settings and switch to Français
or العربية (RTL).

---

## Roadmap / open items

- **Split prod database** onto a dedicated Neon branch (highest priority).
- **Translate deeper pages** (bookings, clients, finance, support, platform).
- **Cross-device locale**: apply a user's saved `locale` on a fresh device
  (sync `user.locale` → cookie on login).
- **Email delivery** for invite links (currently copy-paste; module logs to console).
- **Billing / subscriptions** (per-agency plans).
- **Traveler portal** (end-customer login to view their trips).
