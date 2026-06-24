# Atlas — Complete Reference

Atlas is a **multi-tenant SaaS for travel agencies**. Each agency runs its
clients, sales pipeline, proposals, bookings and finance in a fully isolated
workspace; the vendor manages every agency from a platform console. Multilingual
(EN/FR/AR with RTL), deployed on Vercel with GitHub auto-deploy.

- **Live:** https://agencetool.vercel.app
- **Repo:** github.com/ouks1993/agence_tool
- **Vendor console:** https://agencetool.vercel.app/platform

This is the complete reference. See also `PROJECT.md` (short handbook),
`DESIGN.md` (design system), `AGENTS.md`/`CLAUDE.md` (working conventions).

---

## Table of contents
1. [Tech stack](#tech-stack)
2. [Feature overview](#feature-overview)
3. [Architecture](#architecture)
4. [Roles & permissions](#roles--permissions)
5. [Routes](#routes)
6. [Database schema](#database-schema)
7. [Key modules](#key-modules)
8. [Internationalization](#internationalization)
9. [Local development](#local-development)
10. [Scripts](#scripts)
11. [Deployment](#deployment)
12. [Demo accounts](#demo-accounts)
13. [Roadmap](#roadmap--open-items)
14. [Changelog](#changelog)

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 (`@theme inline`), shadcn/ui (new-york), Lucide icons |
| Fonts | Geist (sans/mono), IBM Plex Sans Arabic (RTL) |
| Auth | Better Auth (email/password, invitation-gated) |
| Database | PostgreSQL (Neon) + Drizzle ORM |
| i18n | next-intl 4 (cookie-based, no URL routing) |
| Charts | recharts 3 (tokenized) |
| AI | Vercel AI SDK + OpenRouter |
| Storage | Vercel Blob (optional) |
| Hosting | Vercel + GitHub auto-deploy |

---

## Feature overview

- **Multi-tenancy** — every record scoped to an `agencyId`; agencies fully isolated; per-agency reference numbering.
- **5-role RBAC** — admin, manager, finance, support, agent, each with a tailored landing & nav.
- **Invitation-only onboarding** — signup gated at the auth layer; `/invite/[token]` accept flow; team-page invites.
- **Vendor platform console** (`/platform`) — create / suspend / reactivate agencies, provision first admin.
- **Impersonation** — *View as agency* (act as agency admin) and *View as user* (act as a specific user with their role + scoped data), with an exit banner.
- **Per-role workspaces** — `/finance` (payments/AR + revenue), `/support` (action queue + clients + ops), agency dashboard with analytics charts.
- **Analytics** — bookings by country, team performance, status breakdown, monthly trend, finance KPIs, revenue/collection charts.
- **Bookings lifecycle** — travellers (passports + alerts), items (flights/hotels/etc.), payments (deposits/installments), itineraries, vouchers/invoices, shareable itinerary links.
- **CRM & pipeline** — clients (+contacts), opportunities across stages, products/proposals with line items.
- **AI assistant** — agency-scoped tools (find clients, bookings summary, create booking).
- **i18n** — English / French / Arabic with full RTL + Arabic font.
- **Settings** — language, theme (light/dark/system), profile.
- **Currencies** — EUR, USD, GBP, DZD, MAD, AED, CHF.

---

## Architecture

### Multi-tenancy
Every business table carries `agencyId` (tenant roots) or inherits it through a
parent (children). **All** reads/writes are scoped by agency, enforced in actions
and pages via `requireAgencyUser()` → `user.agencyId`. References (`BKG-…`,
`PRD-…`) are unique **per agency**. Re-verified by `scripts/test-tenant-isolation.ts`.

### Auth & onboarding
- Better Auth (`src/lib/auth.ts`) — email/password. The `user.create.before` hook
  makes signup **invitation-only**: it requires a pending `agency_invite` matching
  the email, stamps `agencyId` + role, and rejects everyone else (blocks the raw
  signup endpoint too). `BETTER_AUTH_URL`/`baseURL` + `trustedOrigins` set so the
  deployed domain is trusted.
- Guards (`src/lib/permissions.ts`): `requireUser`, `requireAgencyUser`
  (tenant + agency-suspension lockout), `requireManager`, `requireCapability`,
  `requirePlatformAdmin`.

### Platform admin (vendor)
A user with `isPlatformAdmin = true`, `agencyId = null` — above all tenants,
routed to `/platform`. Cannot enter a tenant app except via impersonation.

### Impersonation (cookie-driven, platform-admin only)
- `viewAsAgency(agencyId)` → cookie `platform_view_agency` → acts as agency **admin**.
- `viewAsUser(userId)` → cookie `platform_view_user` (takes precedence) → adopts
  that user's identity, agency and **role** (full fidelity — an agent sees only
  their work).
- Resolved in `requireUser`; `user.impersonating` = `"agency" | "user" | null`
  drives the exit banner. `exitAgencyView()` clears both cookies.

### Per-role landing
`roleHome(role)` routes finance → `/finance`, support → `/support`, else
`/dashboard` (which itself adapts: agency-wide for admin/manager, scoped "Your
work" for agents). App-shell nav is role-aware via a `show(role)` predicate per item.

---

## Roles & permissions

Defined in `src/lib/domain.ts`.

| Role | Sees all data | Team mgmt | Payments | Finance view | Support view | Delete | Home |
|---|---|---|---|---|---|---|---|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | /dashboard |
| manager | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | /dashboard |
| finance | ✅ | — | ✅ | ✅ | — | — | /finance |
| support | ✅ | — | — | — | ✅ | — | /support |
| agent | own only | — | — | — | — | — | /dashboard (scoped) |

Capability helpers: `seesAllData`, `canManageTeam`, `canAssignAdmin`,
`canManagePayments`, `canViewFinance`, `canViewSupport`, `canDeleteRecords`,
`roleHome`. Only an **admin** can assign/change the admin role.

---

## Routes

**Authenticated app** (`(app)/`, gated by `requireAgencyUser`):
`dashboard`, `finance`, `support`, `bookings` (+ `new`, `[id]`, `[id]/edit`,
`[id]/itinerary`), `clients` (+ `new`, `[id]`, `[id]/edit`), `opportunities`
(+ `new`, `[id]`, `[id]/edit`), `products` (+ `new`, `[id]`, `[id]/edit`),
`operations`, `search`, `assistant`, `team`, `settings`, `profile`.

**Platform** (`platform/`, gated by `requirePlatformAdmin`): `platform`,
`platform/agencies/new`, `platform/agencies/[id]`.

**Auth** (`(auth)/`): `login`, `register` (invite-only notice),
`forgot-password`, `reset-password`. **Accept invite:** `invite/[token]`.

**Public / docs:** `i/[token]` (shareable itinerary, unauth),
`proposal/[id]`, `booking-docs/[id]/voucher`, `booking-docs/[id]/invoice`.

**API:** `api/auth/[...all]` (Better Auth), `api/chat` (AI assistant).

---

## Database schema

`src/lib/schema.ts`. Tenant column shown where present.

| Table | Tenancy | Notes |
|---|---|---|
| `agency` | (root) | name, slug, status (active/suspended) |
| `agency_invite` | agencyId | email, role, token, status, expiresAt |
| `user` | agencyId (nullable) | + `isPlatformAdmin`, `role`, `active`, `locale` (Better Auth) |
| `session`, `account`, `verification` | via user | Better Auth |
| `client` | agencyId | + `client_contact` (child) |
| `opportunity` | agencyId | pipeline stage, value, currency |
| `product` | agencyId | proposal; ref unique per agency; + `product_item` (child) |
| `booking` | agencyId | ref unique per agency; shareToken |
| `booking_traveller`, `booking_item`, `payment`, `booking_day` | via booking | children |
| `notification` | agencyId | comms log |
| `activity_log` | agencyId | audit trail |

**Migrations** (`drizzle/`): `0006` tenancy + backfill, `0007` agency_invite,
`0008` user.locale. Workflow: `db:generate` → `db:migrate` (**never** `db:push`).

---

## Key modules

**`src/lib/`**
- `domain.ts` — roles, capabilities, enums (statuses, stages, item types,
  currencies), `roleHome`, status/role metadata.
- `permissions.ts` — auth guards + impersonation resolution.
- `auth.ts` / `auth-client.ts` — Better Auth config + client.
- `invites.ts` — create/find/accept invite tokens (7-day TTL).
- `queries.ts` — shared agency-scoped pickers.
- `activity.ts` — `logActivity` (agency-scoped audit).
- `db.ts`, `schema.ts`, `env.ts`, `config.ts`, `format.ts`, `utils.ts`,
  `itinerary.ts`, `storage.ts`.

**`src/lib/actions/`** (server actions, all agency-scoped):
`clients`, `opportunities`, `products`, `bookings`, `payments`, `notifications`,
`team`, `invites`, `platform`, `settings`, `search`.

**`src/i18n/`** — `config.ts` (locales, metadata, dir), `request.ts` (next-intl
request config reading the `locale` cookie). Messages: `messages/{en,fr,ar}.json`.

**`src/components/`** — `app/` (shell, page-header, stat-card, status-badge),
`charts/` (BarInsight/DonutInsight/AreaInsight), `settings/`, `team/`,
`platform/`, `auth/`, `bookings/`, `clients/`, `products/`, `opportunities/`,
`documents/`, `ui/` (shadcn).

---

## Internationalization

- **Locales:** `en`, `fr`, `ar` (Arabic = RTL). Cookie-based (`locale`), no
  URL-locale routing — all routes unchanged.
- Root layout sets `<html lang dir>` and applies IBM Plex Sans Arabic for RTL
  (`html[dir="rtl"] body` in `globals.css`).
- Translated surfaces: nav, login, dashboard, settings. Others fall back to
  English. **To translate a string:** add the key to all three `messages/*.json`
  and swap to `t("…")` (`getTranslations` in server, `useTranslations` in client).
- Language is changed in **Settings**; choice is saved to `user.locale` and the
  cookie. (Known gap: a fresh device without the cookie shows English until the
  user re-picks — i.e. `user.locale` isn't yet synced to the cookie on login.)

---

## Local development

```bash
npm install --legacy-peer-deps    # better-auth peer range
npm run dev                       # http://localhost:3000
npm run check                     # lint + typecheck
npm run build:ci                  # next build
```

**Env (`.env`):** required `POSTGRES_URL`, `BETTER_AUTH_SECRET`. Optional
`OPENROUTER_API_KEY` (AI chat), `BLOB_READ_WRITE_TOKEN` (uploads),
`GOOGLE_CLIENT_ID`/`SECRET`, `NEXT_PUBLIC_APP_URL`.

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
```

---

## Deployment

- **Vercel** project `atlasproject/agence_tool`, connected to GitHub.
- **Auto-deploy:** `git push origin main` → builds & ships production.
- **Manual:** `npx vercel deploy --prod --yes`.
- `vercel.json` → `buildCommand: npm run build:ci`; `.npmrc` →
  `legacy-peer-deps=true`.
- **Vercel env:** `POSTGRES_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`,
  `BETTER_AUTH_URL` (fixes `INVALID_ORIGIN` on the deployed domain).

> ⚠️ **Prod and local dev share one Neon database.** Split prod onto its own Neon
> branch before onboarding real customers.

---

## Demo accounts

Throwaway accounts on the **Demo Agency** for demos. All on the live site.

| Role | Email | Password |
|---|---|---|
| Platform admin (vendor) | `ouksili.abdelmalek@gmail.com` | `Atlas!2026` |
| Manager | `yasmine@agence.test` | `Agency!2026` |
| Finance | `finance@demo.test` | `Finance!2026` |
| Support | `support@demo.test` | `Support!2026` |
| Agent | `karim@demo.test` | `Agent!2026` |
| Agent | `lina@demo.test` | `Agent!2026` |
| Agent | `omar@demo.test` | `Agent!2026` |

> 🔒 **DEMO CREDENTIALS ONLY** — these are throwaway accounts for the demo
> agency. **Rotate or delete them before any real production use**, and do not
> reuse these passwords. Reset/recreate via the scripts above.

**Suggested demo flow:** sign in as the vendor → `/platform` → create an agency
(or *View as* Demo Agency) → manager dashboard charts → switch logins to show
finance / support / agent views → Settings → switch to Français or العربية (RTL).

---

## Roadmap / open items

1. **Split prod database** onto a dedicated Neon branch (highest priority before real customers).
2. **Translate deeper pages** (bookings, clients, finance, support, platform).
3. **Cross-device locale** — sync `user.locale` → cookie on login.
4. **Email delivery** for invite links (currently copy-paste; module logs to console).
5. **Billing / subscriptions** — per-agency plans.
6. **Traveler portal** — end-customer login to view their trips.

---

## Changelog

| Commit | Summary |
|---|---|
| `9e8fb4b` | Multi-tenant architecture + vendor platform console |
| `76e55b4` | `vercel.json` for deployment |
| `edc4133` | `legacy-peer-deps` for install (better-auth peer conflict) |
| `aa904d9` | Better Auth baseURL + trustedOrigins (fix INVALID_ORIGIN) |
| `471eed7` | `.vercelignore` (exclude scripts from builds) |
| `f982d2c` | "View as agency" impersonation |
| `1896596` | Per-role workspaces (Finance + Support) + role-based landing/nav |
| `63f1d68` | Analytics charts (dashboard + finance) |
| `7fea32e` | Re-runnable demo data seed |
| `a233d32` | View-as-user + i18n (EN/FR/AR + RTL) + Settings hub |
| `8d679f4` | DZD currency |

Started from a single-agency tool; now a deployed multi-tenant, multilingual SaaS
(~14.5k insertions, 3 migrations).
