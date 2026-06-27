# Atlas — Complete Reference

Atlas is a **multi-tenant SaaS for travel agencies**. Each agency runs its clients, sales pipeline, proposals, bookings and finance in a fully isolated workspace; the vendor manages every agency from a platform console. Multilingual (EN/FR/AR with RTL), deployed on Vercel with GitHub auto-deploy.

- **Live:** https://agencetool.vercel.app
- **Repo:** github.com/ouks1993/agence_tool
- **Vendor console:** https://agencetool.vercel.app/platform

---

## Table of contents

1. [Architecture](#architecture)
2. [Features](#features)
3. [Routes](#routes)
4. [Database schema](#database-schema)
5. [Key modules](#key-modules)
6. [Internationalization](#internationalization)
7. [Local development](#local-development)
8. [Operations](#operations)
9. [Roadmap & changelog](#roadmap--changelog)

---

## Architecture

### Tech stack

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
| Payments | Stripe Connect (traveler → agency, destination charges) |
| Flights | Duffel (Amadeus self-service kept only as legacy fallback) |
| Hotels | Hotelbeds (APITUDE: availability + content) |
| PDF | `@react-pdf/renderer` (server-rendered proposals) |
| Storage | Vercel Blob (optional) |
| Hosting | Vercel + GitHub auto-deploy |

### Multi-tenancy

Every business table carries `agencyId` (tenant roots) or inherits it through a parent (children). **All** reads/writes are scoped by agency, enforced in actions and pages via `requireAgencyUser()` → `user.agencyId`. References (`BKG-…`, `PRD-…`) are unique **per agency**. Re-verified by `scripts/test-tenant-isolation.ts`.

### Auth & onboarding

- Better Auth (`src/lib/auth.ts`) — email/password. The `user.create.before` hook makes signup **invitation-only**: it requires a pending `agency_invite` matching the email, stamps `agencyId` + role, and rejects everyone else (blocks the raw signup endpoint too). `BETTER_AUTH_URL`/`baseURL` + `trustedOrigins` set so the deployed domain is trusted.
- Guards (`src/lib/permissions.ts`): `requireUser`, `requireAgencyUser` (tenant + agency-suspension lockout), `requireManager`, `requireCapability`, `requirePlatformAdmin`.

### Platform admin (vendor)

A user with `isPlatformAdmin = true`, `agencyId = null` — above all tenants, routed to `/platform`. Cannot enter a tenant app except via impersonation.

### Impersonation (cookie-driven, platform-admin only)

- `viewAsAgency(agencyId)` → cookie `platform_view_agency` → acts as agency **admin**.
- `viewAsUser(userId)` → cookie `platform_view_user` (takes precedence) → adopts that user's identity, agency and **role** (full fidelity — an agent sees only their work).
- Resolved in `requireUser`; `user.impersonating` = `"agency" | "user" | null` drives the exit banner. `exitAgencyView()` clears both cookies.

### Per-role landing

`roleHome(role)` routes finance → `/finance`, support → `/support`, else `/dashboard` (which itself adapts: agency-wide for admin/manager, scoped "Your work" for agents). App-shell nav is role-aware via a `show(role)` predicate per item.

### Roles & permissions

Defined in `src/lib/domain.ts`.

| Role | Sees all data | Team mgmt | Payments | Finance view | Support view | Delete | Home |
|---|---|---|---|---|---|---|---|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | /dashboard |
| manager | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | /dashboard |
| finance | ✅ | — | ✅ | ✅ | — | — | /finance |
| support | ✅ | — | — | — | ✅ | — | /support |
| agent | own only | — | — | — | — | — | /dashboard (scoped) |

Capability helpers: `seesAllData`, `canManageTeam`, `canAssignAdmin`, `canManagePayments`, `canViewFinance`, `canViewSupport`, `canDeleteRecords`, `roleHome`. Only an **admin** can assign/change the admin role.

---

## Features

### Core platform
- **Multi-tenancy** — every record scoped to an `agencyId`; agencies fully isolated; per-agency reference numbering.
- **5-role RBAC** — admin, manager, finance, support, agent, each with a tailored landing & nav.
- **Invitation-only onboarding** — signup gated at the auth layer; `/invite/[token]` accept flow; team-page invites.
- **Vendor platform console** (`/platform`) — create / suspend / reactivate agencies, provision first admin.
- **Impersonation** — *View as agency* (act as agency admin) and *View as user* (act as a specific user with their role + scoped data), with an exit banner.
- **Per-role workspaces** — `/finance` (payments/AR + revenue + commissions), `/support` (action queue + clients + ops), agency dashboard with analytics charts.
- **Analytics** — bookings by country, team performance, status breakdown, monthly trend, finance KPIs, revenue/collection charts.
- **i18n** — English / French / Arabic with full RTL + Arabic font.
- **Settings** — language, theme (light/dark/system), profile.
- **Currencies** — EUR, USD, GBP, DZD, MAD, AED, CHF.

### CRM & pipeline
- **Clients** — client records with contacts; funnel timeline (activity log + notifications + payments in one chronological view); linked opportunities, proposals, and bookings on the detail page.
- **Opportunities** — pipeline stages, value, currency; link to proposals.
- **Proposals & e-signature** — server-rendered PDF proposals; public tokenized `/p/[token]` link (no login) **and** in-portal signing; e-sign stamps signer name/email/IP/UA; flips opportunity to won. Sharing consolidated into one "Share with client ▾" dropdown. **Convert accepted proposal → booking** with one click.

### Bookings
- **Booking lifecycle** — `draft → awaiting_payment → confirmed → ticketed → completed`; visual stepper on detail page with "Advance to [next]" button; hard prerequisites enforced server-side (confirmed requires items + zero balance; ticketed requires items).
- **Trip services** — flights, hotels, transfers, excursions, insurance, fees; supplier picker links items to managed suppliers.
- **Travellers** — passports, nationality, expiry alerts.
- **Payments** — deposits, installments, Stripe Connect online payments.
- **Itinerary** — day-by-day timeline; AI-generated or manual; shareable `/i/[token]` link.
- **Vouchers / Invoices** — PDF documents; blocked when booking has no trip services.
- **List/Board toggle** — switch Bookings page between table and kanban (same data as Pipeline page).
- **Inline search** — "Search flights/hotels" button on the trip services panel opens a search sheet pre-scoped to the booking's destination.

### Supplier management
- **Supplier directory** (`/suppliers`) — manage hotels, airlines, car rental, DMC, insurance, etc. with CRUD, type/status filters.
- **Contracts & rates** — commission basis (percent/fixed/net), validity dates, PDF upload via Vercel Blob; structured rate entries per contract.
- **Supplier picker** — combobox on booking items and proposal items replaces free-text supplier field.

### Commissions
- **Two-ledger tracking** — `supplier_to_agency` (agency earns from supplier per booking item) and `agency_to_agent` (agent earns from agency per booking).
- **Auto-generation** — commissions generated automatically when a booking is confirmed or ticketed; idempotent.
- **Ledger** (`/commissions`) — filter by type/status/agent/date; per-currency summary cards; inline per-booking commissions section (finance roles).
- **Finance page KPIs** — pending/earned/paid commission totals alongside payment KPIs.

### Client portal
- **Magic-link login** — passwordless sessions scoped to one client; separate from staff auth.
- **Portal invite** — agents send the magic link from the client or booking detail page; link is copyable when email is unconfigured.
- **Trip view** — client sees their bookings, itinerary items, and payment summary.
- **Online payments** — "Pay now" via Stripe Connect (only when agency is onboarded); success banner on return.
- **Proposal signing** — client can accept/decline proposals from within the portal; full e-sign audit (same as public `/p/[token]` flow).

### Travel sourcing
- **Flights (Duffel)** — airport autocomplete, one-way/round-trip, flight codes, connecting airports; falls back to sample data.
- **Hotels (Hotelbeds)** — Booking.com-style search/results/details, dynamic occupancy pricing, filters, room photos, add-to-proposal/booking; content cache serves real photos quota-free.
- **Hotel module** (`/hotels`) — full search bar with dynamic occupancy (rooms/adults/children + per-child ages), filter sidebar, sort + pagination + compare, details page with gallery/facilities/map.
- **AI assistant** (`/assistant`) — chat with agency-scoped tools: find clients, bookings summary, create booking, search flights/hotels.

### AI inline features
- **AI itinerary generation** — one-click generation from booking items; saves to `booking_day` rows.
- **AI quote builder** — natural-language brief → structured proposal line items pre-filled in the new-proposal form.
- **AI email drafting** — generate subject + body for confirmation, voucher, follow-up, or custom emails from the booking messages panel.
- **AI visa assistant** — per-nationality visa requirement summary from traveller passport nationalities + booking destination.

### Email delivery
- **Resend** — invite emails, password-reset, proposal acceptance, portal invites; logs to console + `notification` table when unconfigured.

### SaaS billing
- **Stripe subscriptions** — vendor bills agencies; 14-day trial on provision; webhook reconciles status; `requireAgencyUser` gates on lapsed subscription.
- **Stripe Connect** — agencies onboard a connected Express account to receive traveler payments directly; platform takes a configurable fee.

### UX
- **Getting-started checklist** — dismissible 4-step card on the dashboard for new agencies; dismissed state persists in DB across devices and team members.
- **Lifecycle stepper** — horizontal progress bar on booking detail with advance button and soft/hard prerequisite guards.
- **Role-gated nav** — locked nav items shown dimmed with tooltip for non-admin roles.

---

## Routes

**Authenticated app** (`(app)/`, gated by `requireAgencyUser`):
`dashboard`, `finance`, `commissions` (canViewFinance), `support`,
`bookings` (+ `new`, `[id]`, `[id]/edit`, `[id]/itinerary`),
`clients` (+ `new`, `[id]`, `[id]/edit`),
`opportunities` (+ `new`, `[id]`, `[id]/edit`),
`products` (+ `new`, `[id]`, `[id]/edit`),
`suppliers` (+ `new`, `[id]`, `[id]/edit`) (canManageTeam),
`operations` (Pipeline board),
`search`, `hotels` (+ `[code]` details), `assistant`,
`team` (canManageTeam), `billing` (admin-only), `settings`, `profile`.

**Client portal** (`portal/`, gated by `requirePortalSession`):
`portal` (trip list), `portal/bookings/[id]` (detail + pay),
`portal/proposals` (list), `portal/proposals/[id]` (view + sign),
`portal/login`.

**Platform** (`platform/`, gated by `requirePlatformAdmin`): `platform`,
`platform/agencies/new`, `platform/agencies/[id]`.

**Auth** (`(auth)/`): `login`, `register` (invite-only notice),
`forgot-password`, `reset-password`. **Accept invite:** `invite/[token]`.

**Public / docs:** `i/[token]` (shareable itinerary, unauth),
`p/[token]` (public signable proposal) + `p/[token]/pdf`,
`proposal/[id]` (internal preview) + `proposal/[id]/pdf`,
`booking-docs/[id]/voucher`, `booking-docs/[id]/invoice`.

**API:** `api/auth/[...all]` (Better Auth), `api/chat` (AI assistant),
`api/stripe/webhook` (subscription reconciliation),
`api/stripe/connect-webhook` (Connect payment reconciliation),
`api/portal/auth/request` · `verify` · `signout` (portal magic-link flow).

---

## Database schema

`src/lib/schema.ts`. Tenant column shown where present.

| Table | Tenancy | Notes |
|---|---|---|
| `agency` | (root) | name, slug, status (active/suspended); **Stripe billing**: stripeCustomerId, stripeSubscriptionId, subscriptionStatus, priceId, currentPeriodEnd, trialEndsAt; **Connect**: stripeConnectAccountId, stripeConnectOnboarded; `onboardingDismissedAt` (getting-started card) |
| `agency_invite` | agencyId | email, role, token, status, expiresAt |
| `user` | agencyId (nullable) | + `isPlatformAdmin`, `role`, `active`, `locale`, `commissionRatePercent` (Better Auth) |
| `session`, `account`, `verification` | via user | Better Auth |
| `portal_session` | via client | passwordless client portal sessions; token + expiresAt |
| `client` | agencyId | + `client_contact` (child) |
| `opportunity` | agencyId | pipeline stage, value, currency |
| `product` | agencyId | proposal; ref unique per agency; + `product_item` (child; `supplierId` FK optional); **e-sign**: shareToken (unique), acceptedAt/declinedAt, signerName/Email, signatureData, signerIp/UserAgent |
| `booking` | agencyId | ref unique per agency; shareToken |
| `booking_traveller`, `booking_item` (+ `supplierId` FK), `payment`, `booking_day` | via booking | children |
| `notification` | agencyId | comms log |
| `activity_log` | agencyId | audit trail |
| `supplier` | agencyId | managed supplier directory (hotels, airlines, DMC, etc.) |
| `supplier_contract` | agencyId | commission basis/rate, validity dates, file URL |
| `supplier_rate` | via contract | structured per-product rates within a contract |
| `commission` | agencyId | earnings ledger: supplier→agency and agency→agent; bookingId, supplierId, agentUserId, basis, rate, amount, status |
| `hotel_content` | (global) | Hotelbeds content cache (photos, facilities, coords) — shared reference data, **not** tenant-scoped; PK is the Hotelbeds hotel code |

### Migrations

| Migration | What it adds |
|---|---|
| `0006` | Tenancy + backfill (`agencyId` on all tables) |
| `0007` | `agency_invite` table |
| `0008` | `user.locale` |
| `0009` | Agency Stripe billing columns |
| `0010` | Product e-signature columns |
| `0011` | `hotel_content` cache |
| `0012` | Stripe Connect columns on `agency` |
| `0013` | `portal_session` table |
| `0014` | `supplier`, `supplier_contract`, `supplier_rate` tables; `supplierId` FK on `booking_item` + `product_item` |
| `0015` | `commission` table; `user.commissionRatePercent` |
| `0016` | `agency.onboardingDismissedAt` |

Workflow: `db:generate` → `db:migrate` (**never** `db:push`).
Run on prod: `POSTGRES_URL=<prod-url> npx drizzle-kit migrate`.

---

## Key modules

**`src/lib/`**
- `domain.ts` — roles, capabilities, enums (statuses, stages, item types, currencies), `roleHome`, status/role metadata.
- `permissions.ts` — auth guards + impersonation resolution.
- `auth.ts` / `auth-client.ts` — Better Auth config + client.
- `invites.ts` — create/find/accept invite tokens (7-day TTL).
- `queries.ts` — shared agency-scoped pickers.
- `activity.ts` — `logActivity` (agency-scoped audit).
- `db.ts` (validates env via `getServerEnv`), `schema.ts`, `env.ts`, `config.ts`, `format.ts`, `utils.ts`, `itinerary.ts`, `storage.ts`.
- `notifications/email.ts` (Resend adapter) + `notifications/templates.ts` (HTML).
- `billing/stripe.ts` — SaaS subscriptions, checkout, portal, manual webhook signature verification (distinct from `payments/stripe.ts` = traveler payments).
- `payments/stripe.ts` — Stripe Connect: create account, onboarding link, checkout session (destination charges).
- `suppliers/` — `index.ts` (per-vertical `getFlightSupplier`/`getHotelSupplier` + `safeSearch`), `duffel.ts`, `hotelbeds.ts`, `content-cache.ts`, `amadeus.ts` (legacy), `mock.ts`, `types.ts`.
- `documents/proposal-pdf.tsx` + `proposal-data.ts` — proposal PDF rendering.
- `portal-session.ts` — `getPortalSession` / `requirePortalSession` (httpOnly cookie).

**`src/lib/actions/`** (server actions, all agency-scoped):
`clients`, `opportunities`, `products`, `proposals-public`, `bookings`, `payments`, `notifications`, `team`, `invites`, `platform`, `billing`, `settings`, `search`, `suppliers`, `commissions`, `portal-payments`, `portal-proposals`, `portal-invite`, `onboarding`, `ai`.

**`src/i18n/`** — `config.ts` (locales, metadata, dir), `request.ts` (next-intl request config reading the `locale` cookie). Messages: `messages/{en,fr,ar}.json`.

**`src/components/`** — `app/` (shell, page-header, stat-card, status-badge, getting-started-card), `charts/`, `settings/`, `team/`, `platform/`, `auth/`, `bookings/` (incl. lifecycle stepper, search sheet, board), `clients/` (incl. portal invite, timeline), `products/` (incl. convert-to-booking, AI quote builder), `opportunities/`, `billing/`, `commissions/`, `suppliers/`, `portal/`, `search/`, `documents/`, `ui/` (shadcn).

---

## Internationalization

- **Locales:** `en`, `fr`, `ar` (Arabic = RTL). Cookie-based (`locale`), no URL-locale routing — all routes unchanged.
- Root layout sets `<html lang dir>` and applies IBM Plex Sans Arabic for RTL (`html[dir="rtl"] body` in `globals.css`).
- Translated surfaces: nav, login, dashboard, settings. Others fall back to English. **To translate a string:** add the key to all three `messages/*.json` and swap to `t("…")` (`getTranslations` in server, `useTranslations` in client).
- Language is changed in **Settings**; choice is saved to `user.locale` and the cookie. (Known gap: a fresh device without the cookie shows English until the user re-picks — `user.locale` isn't yet synced to the cookie on login.)

---

## Local development

```bash
npm install --legacy-peer-deps    # better-auth peer range
npm run dev                       # http://localhost:3000
npm run check                     # lint + typecheck
npm run build:ci                  # next build
```

**Env (`.env`):** required `POSTGRES_URL`, `BETTER_AUTH_SECRET`. Optional:
`OPENROUTER_API_KEY` (AI features), `BLOB_READ_WRITE_TOKEN` (uploads),
`GOOGLE_CLIENT_ID`/`SECRET`, `NEXT_PUBLIC_APP_URL`,
`RESEND_API_KEY`/`EMAIL_FROM` (email),
`STRIPE_SECRET_KEY`/`STRIPE_PRICE_ID`/`STRIPE_WEBHOOK_SECRET` (billing),
`STRIPE_CONNECT_WEBHOOK_SECRET`/`STRIPE_PLATFORM_FEE_PERCENT` (Connect payments),
`DUFFEL_API_TOKEN` (flights), `HOTELBEDS_API_KEY`/`HOTELBEDS_SECRET` (hotels).
All integrations degrade gracefully to sample/logged behaviour when unset.
`PROTECTED_DB_HOSTS` makes destructive scripts refuse a prod DB (override `ALLOW_PROD=1`).

**Database:** dev branch `ep-dawn-voice-ai8d6q3o`, prod branch `ep-misty-thunder-aixz34vy`.
After schema changes: `db:generate` → `db:migrate`. `db:studio` to browse.
**Always run migrations on prod after deploy:** `POSTGRES_URL=<prod-url> npx drizzle-kit migrate`.

### Scripts

```bash
# Promote an existing account to the platform super-admin
npx tsx --env-file=.env scripts/make-platform-admin.ts <email>

# Seed / reset the Demo Agency (idempotent — wipes its data, keeps users, reseeds)
npx tsx --env-file=.env scripts/seed-demo-data.ts

# Cross-tenant isolation test (seeds 2 agencies, asserts no leak, cleans up)
npx tsx --env-file=.env scripts/test-tenant-isolation.ts

# Sync Hotelbeds hotel content (photos/facilities/coords) into the cache table.
npx tsx --env-file=.env scripts/sync-hotel-content.ts            # curated destinations
npx tsx --env-file=.env scripts/sync-hotel-content.ts BCN MAD    # specific codes
```

---

## Operations

### Deployment

- **Vercel** project `atlasproject/agence_tool`, connected to GitHub.
- **Auto-deploy:** `git push origin main` → builds & ships production.
- **Manual:** `npx vercel deploy --prod --yes`.
- `vercel.json` → `buildCommand: npm run build:ci`; `.npmrc` → `legacy-peer-deps=true`.
- **Vercel env:** `POSTGRES_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL`, `PROTECTED_DB_HOSTS=ep-misty-thunder-aixz34vy`.

### Demo accounts

Throwaway accounts on the **Demo Agency**. All on the live site.

| Role | Email | Password |
|---|---|---|
| Platform admin (vendor) | `ouksili.abdelmalek@gmail.com` | `Atlas!2026` |
| Manager | `yasmine@agence.test` | `Agency!2026` |
| Finance | `finance@demo.test` | `Finance!2026` |
| Support | `support@demo.test` | `Support!2026` |
| Agent | `karim@demo.test` | `Agent!2026` |
| Agent | `lina@demo.test` | `Agent!2026` |
| Agent | `omar@demo.test` | `Agent!2026` |

> 🔒 **DEMO CREDENTIALS ONLY** — rotate or delete before any real production use.

**Suggested demo flow:** sign in as vendor → `/platform` → View as Demo Agency → manager dashboard → switch to finance/support/agent views → Settings → switch to Français or العربية.

---

## Roadmap & changelog

### Phase status

**Phase 1 — Sellable ✅ COMPLETE**
Email (Resend) · Stripe SaaS billing · Separate Neon DB branches (dev/prod) · PDF proposals · E-signature · Live flights (Duffel) · Live hotels (Hotelbeds + content cache).

**Phase 2 — Competitive ✅ COMPLETE**
Supplier management (`/suppliers`, contracts, rates, picker) · Commissions tracking (auto-generated, two-ledger, `/commissions`) · Client portal (magic-link login, trip view, online payments via Stripe Connect, in-portal proposal signing + portal invite from agent).

**Phase 3 — AI differentiation ✅ COMPLETE**
AI itinerary generation · AI quote builder · AI email drafting · AI visa assistant — all inline, embedded where the work happens.

**UX overhaul ✅ COMPLETE** (20 changes across 4 size categories)
Getting-started checklist · Lifecycle stepper · Board view toggle · Inline search · Portal invite · Convert proposal→booking · Client funnel timeline · Booking hard guards · Vocabulary pass · Role nav tooltips · Empty-state badges.

### Open items

1. **Real supplier booking** — Duffel orders + Hotelbeds book API (currently search-only).
2. **Translate deeper pages** — bookings, clients, finance, support, platform (i18n plumbing ready).
3. **Cross-device locale** — sync `user.locale` → cookie on login.
4. **WhatsApp integration** — Meta Cloud API adapter (skeleton ready; Meta Business account needed).
5. **Automated quotations** — trigger quote generation from opportunity stage change.
6. **Agent performance scoring** — leaderboard from commission + booking counts.
7. **Convert proposal to booking guard** — add `convertedBookingId` column (needs migration).

### Changelog

| Commit | Summary |
|---|---|
| `441fd6e` | UX large: persistent onboarding (DB), client timeline, booking hard guards |
| `284d00e` | UX medium: lifecycle stepper, board view, inline search, getting-started card |
| `805dbc8` | UX small: portal invite, convert proposal→booking, client funnel view, share consolidation |
| `9c7cc98` | UX quick wins: vocabulary, nav labels, empty charts, dashboard CTA |
| `23ddc35` | Phase 2 & 3: supplier mgmt, commissions, client portal, AI features |
| `94aaf08` | Phase 2: real bookings, Stripe Connect, traveler portal, full i18n |
| `2dd7650` | Embed live flight/hotel search in booking Add dialog |
| `a677b77` | Fix duplicate-reference crash on create booking/proposal |
| `169ee74` | Split atlas.md into focused docs under docs/atlas/ |
| `8c1b24e` | Hotel module: full search/results/details, dynamic occupancy pricing, content cache |
| `b67cfa0` | Phase 1: email (Resend), Stripe billing, e-sign, PDF, suppliers |
| `a233d32` | View-as-user + i18n (EN/FR/AR + RTL) + Settings hub |
| `1896596` | Per-role workspaces (Finance + Support) + role-based landing/nav |
| `9e8fb4b` | Multi-tenant architecture + vendor platform console |

Migrations: 16 (latest `0016`). Dev DB: `ep-dawn-voice-ai8d6q3o`. Prod DB: `ep-misty-thunder-aixz34vy`.
