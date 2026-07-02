# Architecture

Tech choices live in [tech-stack.md](tech-stack.md). This doc covers structure:
multi-tenancy, auth, roles, the route map, the module layout, and i18n plumbing.

## Multi-tenancy

Every business table carries `agencyId` (tenant roots) or inherits it through a
parent (children). **All** reads/writes are scoped by agency, enforced in actions
and pages via `requireAgencyUser()` → `user.agencyId`. References (`BKG-…`,
`PRD-…`) are unique **per agency**. Re-verified by
`scripts/test-tenant-isolation.ts`. See [security.md](security.md) for the
isolation guarantees and [database.md](database.md) for tenancy columns.

## Auth & onboarding

- Better Auth (`src/lib/auth.ts`) — email/password. The `user.create.before` hook
  makes signup **invitation-only**: it requires a pending `agency_invite` matching
  the email, stamps `agencyId` + role, and rejects everyone else (blocks the raw
  signup endpoint too). `BETTER_AUTH_URL`/`baseURL` + `trustedOrigins` set so the
  deployed domain is trusted.
- Guards (`src/lib/permissions.ts`): `requireUser`, `requireAgencyUser` (tenant +
  agency-suspension lockout), `requireManager`, `requireCapability`,
  `requirePlatformAdmin`.

## Platform admin (vendor)

A user with `isPlatformAdmin = true`, `agencyId = null` — above all tenants,
routed to `/platform`. Cannot enter a tenant app except via impersonation.

## Impersonation (cookie-driven, platform-admin only)

- `viewAsAgency(agencyId)` → cookie `platform_view_agency` → acts as agency
  **admin**.
- `viewAsUser(userId)` → cookie `platform_view_user` (takes precedence) → adopts
  that user's identity, agency and **role** (full fidelity — an agent sees only
  their work).
- Resolved in `requireUser`; `user.impersonating` = `"agency" | "user" | null`
  drives the exit banner. `exitAgencyView()` clears both cookies.

## Per-role landing

`roleHome(role)` routes finance → `/finance`, support → `/support`, else
`/dashboard` (which itself adapts: agency-wide for admin/manager, scoped "Your
work" for agents). App-shell nav is role-aware via a `show(role)` predicate per
item.

## Roles & permissions

Defined in `src/lib/domain.ts`. Full capability semantics are in
[business-rules.md](business-rules.md#roles--capabilities).

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

## Scale targets

The capacity Atlas is designed toward, with implications for the current
architecture (single Neon Postgres + Vercel serverless).

| Target | Implication / current state |
|---|---|
| **1,000 agencies** | Multi-tenant single DB; fine with `agencyId` indexes (present). |
| **50,000 users** | Better Auth + Postgres; fine at this scale. |
| **5,000,000 bookings** | Needs solid indexing + pagination (currently hardcoded `limit`s — see [tracker](roadmap.md#spec-vs-reality-gap-tracker)). |
| **500,000,000 activities** | `activity_log` at this size needs **partitioning + archival/retention** — not in place today (single unpartitioned table). |
| **99.9% uptime** | Relies on Vercel + Neon SLAs; no DR runbook yet (see [security.md](security.md#security-controls)). |
| **100 concurrent hotel searches** | Bound by Hotelbeds quota; content cache serves photos quota-free. No concurrency/queue control or [rate limiting](security.md#security-controls) yet. |
| **100 concurrent flight searches** | Bound by Duffel quota; `safeSearch` degrades to sample data on error. No queue/backpressure yet. |

> These are design targets. The gating work to reach them — table partitioning for
> `activity_log`, real pagination, rate limiting/backpressure on search, and a DR
> plan — is in the [gap tracker](roadmap.md#spec-vs-reality-gap-tracker).

## Route map

**Authenticated app** (`(app)/`, gated by `requireAgencyUser`):
`dashboard`, `finance`, `commissions` (canViewFinance), `support`,
`bookings` (+ `new`, `[id]`, `[id]/edit`, `[id]/itinerary`),
`clients` (+ `new`, `[id]`, `[id]/edit`),
`opportunities` (sales **Pipeline** board) (+ `new`, `[id]`, `[id]/edit`),
`products` (+ `new`, `[id]`, `[id]/edit`),
`suppliers` (+ `new`, `[id]`, `[id]/edit`) (canManageTeam),
`operations` (bookings-by-status board),
`reports` (canViewFinance — BI export hub),
`sourcing/flights` (live flight search), `hotels` (+ `[code]` details),
`assistant`, `team` (canManageTeam), `billing` (admin-only), `settings`,
`profile`.

Canonical URLs moved with the UI redesign; `next.config.ts` keeps old bookmarks
working via `rewrites()`/`redirects()`:
- `/proposals` (+ `/proposals/*`) is the canonical URL, **rewritten** (not
  redirected) from the `products` route files — `/products*` **redirects**
  (permanent) to `/proposals*`.
- `/sourcing/hotels` (+ `/sourcing/hotels/*`) is the canonical URL, **rewritten**
  from the `hotels` route files.
- `/search` → `/sourcing/flights` (temporary redirect, during transition).
- `/hotels` (+ `/hotels/*`) → `/sourcing/hotels*` (temporary redirect).
- `/operations` → `/bookings` (temporary redirect; the board-view toggle lives there).

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
`api/export/[entity]` (BI export: CSV/XLSX per dataset + `workbook` = all sheets),
`api/stripe/webhook` (subscription reconciliation),
`api/stripe/connect-webhook` (Connect payment reconciliation),
`api/stripe/connect` (initiate Connect onboarding), `api/stripe/connect/refresh`
· `api/stripe/connect/return` (onboarding link callbacks),
`api/portal/auth/request` · `verify` · `signout` (portal magic-link flow),
`api/cron/cleanup` (daily maintenance sweep — expired idempotency/portal-session/
invite rows; see [deployment.md](deployment.md#scheduled-cleanup)).

## Module layout

**`src/lib/`**
- `domain.ts` — roles, capabilities, enums (statuses, stages, item types,
  currencies + controlled vocabularies: lead source, travel purpose, trip type,
  gender, title, lost reason, industry), `roleHome`, status/role metadata.
- `analytics.ts` — pure dashboard helpers (see [analytics.md](analytics.md)).
- `reference/countries.ts` — ISO 3166-1 list (name, demonym, derived flag) +
  `normalizeCountry()` alias mapping.
- `export/` — `csv.ts` (RFC-4180 + UTF-8 BOM), `xlsx.ts` (exceljs workbook),
  `datasets.ts` (BI dataset registry with dual code/label columns).
- `permissions.ts` — auth guards + impersonation resolution.
- `auth.ts` / `auth-client.ts` — Better Auth config + client.
- `invites.ts` — create/find/accept invite tokens (7-day TTL).
- `queries.ts` — shared agency-scoped pickers.
- `activity.ts` — `logActivity` (agency-scoped audit).
- `db.ts` (validates env via `getServerEnv`), `schema.ts`, `env.ts`, `config.ts`,
  `format.ts`, `utils.ts`, `itinerary.ts`, `storage.ts`.
- `notifications/email.ts` (Resend adapter) + `notifications/templates.ts` (HTML)
  + `notifications/inbox.ts` (in-app inbox emitter — best-effort per-user
  notifications for the topbar bell; `createUserNotifications`, `staffToNotify`,
  event helpers for proposal accept/decline + payment received).
- `billing/stripe.ts` — SaaS subscriptions (distinct from `payments/stripe.ts`).
- `payments/stripe.ts` — Stripe Connect: account, onboarding link, destination
  charges.
- `suppliers/` — `index.ts` (`getFlightSupplier`/`getHotelSupplier` +
  `safeSearch`, legacy), `duffel.ts`, `hotelbeds.ts`, `content-cache.ts`,
  `amadeus.ts` (legacy), `mock.ts`, `types.ts`, `config.ts` (single entry point
  for supplier credential/hostname env resolution), `booking-service.ts`
  (quote → book → cancel orchestration over the registry). `suppliers/providers/`
  — the provider abstraction: `types.ts` (capability interfaces), `registry.ts`
  (`providerRegistry`, capability type-guards, `PROVIDER_CATALOG`), `register.ts`
  (`registerBuiltInProviders()`), `mock-provider.ts`, `duffel-provider.ts`,
  `hotelbeds-provider.ts`.
- `travel-platform/index.ts` — the Travel Platform facade: single entry point for
  `searchFlights`, `searchHotels`, `searchAirports`, `searchHotelDestinations`
  routed through the provider registry. See [api-integrations.md](api-integrations.md).
- `documents/proposal-pdf.tsx` + `proposal-data.ts` — proposal PDF rendering.
- `portal-session.ts` — `getPortalSession` / `requirePortalSession` (httpOnly
  cookie).

**`src/lib/actions/`** (server actions, all agency-scoped):
`clients`, `opportunities`, `products`, `proposals-public`, `bookings`,
`payments`, `notifications`, `team`, `invites`, `platform`, `billing`,
`settings`, `search`, `suppliers`, `commissions`, `portal-payments`,
`portal-proposals`, `portal-invite`, `onboarding`, `ai`, `user-notifications`
(bell inbox: `getMyNotifications`, `markNotificationRead`,
`markAllNotificationsRead` — double-scoped by recipient + agency).

**`src/components/`** — `app/` (shell, page-header, stat-card, status-badge,
getting-started-card), `charts/` (insight-charts incl. `HBarInsight`,
`FunnelInsight`), `reference/` (country-combobox, city-input), `reports/`,
`settings/`, `team/`, `platform/`, `auth/`, `bookings/` (lifecycle stepper, search
sheet, board), `clients/` (portal invite, timeline), `products/` (convert-to-
booking, AI quote builder), `opportunities/`, `billing/`, `commissions/`,
`suppliers/`, `portal/`, `search/`, `documents/`, `ui/` (shadcn).

## Internationalization

- **Locales:** `en`, `fr`, `ar` (Arabic = RTL). Cookie-based (`locale`), no
  URL-locale routing — all routes unchanged.
- `src/i18n/` — `config.ts` (locales, metadata, dir), `request.ts` (next-intl
  request config reading the `locale` cookie). Messages: `messages/{en,fr,ar}.json`.
- Root layout sets `<html lang dir>` and applies IBM Plex Sans Arabic for RTL
  (`html[dir="rtl"] body` in `globals.css`).
- Translated surfaces: nav, login, dashboard, settings. Others fall back to
  English. **To translate a string:** add the key to all three `messages/*.json`
  and swap to `t("…")` (`getTranslations` in server, `useTranslations` in client).
- Language is changed in **Settings**; choice is saved to `user.locale` and the
  cookie. **Known gap:** a fresh device without the cookie shows English until the
  user re-picks — `user.locale` isn't yet synced to the cookie on login (see
  [roadmap.md](roadmap.md) open items).
