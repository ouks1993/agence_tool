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
| Email | Resend (transactional: invites, password reset, proposals) |
| Billing | Stripe subscriptions (vendor → agency) + webhook |
| Flights | Duffel (Amadeus self-service kept only as legacy fallback) |
| Hotels | Hotelbeds (APITUDE: availability + content) |
| PDF | `@react-pdf/renderer` (server-rendered proposals) |
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
- **Proposals & e-signature** — server-rendered PDF proposals; public, tokenized `/p/[token]` link where a client reviews and **e-signs** (signature + IP/UA audit) → flips the product to accepted and the opportunity to won.
- **Email delivery (Resend)** — real invite emails, password-reset/verification, proposal acceptance; logs to console + `notification` table when unconfigured.
- **SaaS billing (Stripe)** — vendor bills agencies via subscriptions; 14-day trial on provision; webhook reconciles status; `requireAgencyUser` gates on a lapsed subscription.
- **Live travel sourcing** — Duffel flights (airport autocomplete, one-way/round-trip, flight codes, layover airports) and Hotelbeds hotels (destination autocomplete, Booking-style cards with photos, room type, hotel type, board, facilities, room photos, filters); falls back to sample data without keys.
- **Hotel module** (`/hotels`) — Booking.com-style flow: search bar with dynamic occupancy (rooms/adults/children + per-child ages), filter sidebar (price/stars/type/meal/distance/cancellation/supplier), sort + pagination + compare; details page with gallery, facilities, OpenStreetMap, **occupancy-driven dynamic room pricing**, reviews, and add-to-proposal/booking. Real Hotelbeds photos served via a DB content cache (see below).
- **Hotel content cache** — Hotelbeds splits photos (Content API) from prices (availability API), each with its own quota. Content is cached in `hotel_content` and served quota-free; reads are cache-first with live self-heal, bulk-filled by `scripts/sync-hotel-content.ts`. Real hotel/room photos show even when the availability quota is exhausted (rates then shown as estimated).
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

---

## Database schema

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

**Done this phase (Phase 1 "sellable"):** ✅ Email delivery (Resend) · ✅ Stripe
SaaS billing (subscriptions + webhook + gating; **Connect for traveler payments
deferred**) · ✅ DB-split safety (env validation + prod-guarded scripts; the
dedicated Neon branch itself is still a manual ops step) · ✅ PDF proposals ·
✅ E-signature acceptance · ✅ Live flights (Duffel) + hotels (Hotelbeds) with
rich search UX. Plan + manual setup in `specs/phase-1/PLAN.md`.

**Open:**
1. **Provision the dedicated prod Neon branch** (code-side guard is in; the branch is manual).
2. **Stripe Connect** — traveler payment collection (Phase 1.5).
3. **Translate deeper pages** (bookings, clients, finance, support, platform).
4. **Cross-device locale** — sync `user.locale` → cookie on login.
5. **Traveler portal** — end-customer login to view their trips.
6. **Real booking** of supplier offers (Duffel orders / Hotelbeds book currently
   provisional) and persist offers into `bookingItem.details` from the AI tool.

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
| `b67cfa0` | Phase 1: email (Resend), Stripe billing, e-sign, PDF, suppliers |
| `eb467d0` | Switch flights to Duffel (Amadeus self-service sunsetting) |
| `508472e` | One-way flight option + flight codes |
| `b7ffa6d` | Connecting airports for multi-stop flights |
| `78ceb59` | Airport autocomplete (Duffel Places) |
| `1a92e27` | Hotel details view with photos (Hotelbeds Content) |
| `b3b6d20` | Hotel destination autocomplete |
| `74e0938` | Booking-style hotel cards with photo thumbnails |
| `957079b` | Room type, hotel type, facilities, room photos + hotel filters |
| _pending_ | Hotel module (`/hotels`): search/results/details, dynamic occupancy pricing, proposal integration |
| _pending_ | Hotel content cache (`hotel_content` + `sync-hotel-content.ts`) — real photos served quota-free |

Started from a single-agency tool; now a deployed multi-tenant, multilingual SaaS
with live travel sourcing, billing, and e-signature. Migrations: 6 (latest `0011`).
