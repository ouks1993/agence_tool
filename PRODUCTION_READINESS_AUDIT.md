# Atlas — Production Readiness Audit Report
Date: 2026-06-28

> **Remediation status (applied 2026-06-28):** The safe high-priority tranche
> (both Criticals + all 13 Highs + several low-risk Mediums/Lows) has been
> implemented via coordinated sub-agents and verified with `tsc --noEmit`
> (clean), `npm run lint` (0 errors), and `next build` (all routes compile).
> See **§ Remediation Applied** at the end of this report for the full list of
> fixes, files changed, and remaining items. **One blocker is environmental:**
> the DB index migration `drizzle/0018_regular_karnak.sql` is generated but
> **not yet applied** — the dev Neon credentials in `.env` return
> `28P01 password authentication failed` (password rotated). Refresh
> `POSTGRES_URL` and run `npx drizzle-kit migrate` to apply it.

## Executive Summary

Atlas has a fundamentally sound architecture: tenant isolation via `requireAgencyUser()` and double-condition `and(eq(agencyId, ...), ...)` scoping is consistent across all 20 server-action files, all inputs are Zod-validated, and there is no SQL injection or `dangerouslySetInnerHTML` exposure. However, the application is **not yet production-ready** without remediation. The two genuine blockers are silent fake-PNR fallback on failed airline bookings (agents see a confirmation for a flight that was never booked) and missing try/catch on Stripe webhook DB writes (crashes cause endless Stripe retries with duplicate side-effects). Counting across all six audits: **2 critical blockers, 11 high-severity, 21 medium-severity, and ~20 low-severity** issues. The high-severity cluster is dominated by missing error handling (no try/catch in 10 action files, no `error.tsx` in client-facing segments), absent `fetch` timeouts on all external supplier calls, RTL breakage in the mobile drawer, and a prompt-injection vector in the AI chat endpoint.

## Critical Issues (must fix before production)

| # | Category | File | Issue | Fix |
|---|---|---|---|---|
| C1 | Error Handling | `src/lib/suppliers/duffel.ts:278`, `src/lib/actions/bookings.ts:382` | Failed Duffel order silently falls back to a fake `DF-XXXXXXXX` reference and marks booking `confirmed` — agent sees success, no real PNR exists | Return discriminated provisional/confirmed result; never set `status: "confirmed"` on a provisional; surface a visible UI warning |
| C2 | Error Handling | `src/app/api/stripe/webhook/route.ts:75-86`, `src/app/api/stripe/connect-webhook/route.ts:40-46` | No try/catch around webhook DB updates; a DB throw returns 500 and Stripe retries indefinitely → duplicate side-effects. `connect-webhook` also returns 400 (stops retries) when temporarily misconfigured instead of 503 | Wrap DB writes in try/catch returning 500 only on genuine transient errors; return 503 (not 400) for misconfiguration so Stripe retries cleanly |

## High Severity Issues

| # | Category | File | Issue | Fix |
|---|---|---|---|---|
| H1 | Security | `src/app/api/chat/route.ts:28-36` | Zod schema accepts `role: "system"` from client → prompt injection / jailbreak of the AI agent, including spurious `createBooking` calls | Drop `"system"` from the client enum: `z.enum(["user","assistant"])` |
| H2 | Security | `src/app/api/portal/auth/signout/route.ts:2,15`; `src/app/portal/layout.tsx:39` | Portal signout is `GET` via `<a href>` → CSRF forced-logout (CWE-352) | Change handler to `POST`; use `<form method="POST">` button |
| H3 | Error Handling | 10 action files (`clients.ts:45`, `team.ts`, `suppliers.ts`, `invites.ts`, `opportunities.ts`, `portal-proposals.ts`, `notifications.ts`, `proposals-public.ts`, `portal-invite.ts`, `onboarding.ts`) | Zero try/catch around DB calls → unhandled exceptions crash the action with a generic 500, no logging | Wrap DB writes; return `{ ok:false, error:"…" }`; `console.error("[action]", err)` |
| H4 | Error Handling | `src/app/api/chat/route.ts:77-277` | `streamText` and all tool `execute` bodies have no try/catch; `createBooking` item loop silently skips failed items | Wrap `streamText` and each tool body in try/catch returning JSON error |
| H5 | Error Handling | `src/lib/suppliers/duffel.ts:39`, `hotelbeds.ts:159`, `payments/stripe.ts` | No `fetch` timeout (AbortController) on any external call → function hangs to Vercel's 30s timeout | Add `AbortController` + `setTimeout(..., 15000)` to each provider's base fetch wrapper |
| H6 | Error Handling | `src/app/portal/`, `src/app/platform/`, `src/app/(app)/bookings/`, `src/app/(app)/clients/` | No segment-level `error.tsx`; errors bubble to root boundary whose "Go home" link points to `/` (inaccessible to portal clients) | Add `error.tsx` per segment with context-appropriate recovery (portal → `/portal/login`) |
| H7 | Performance | `src/app/(app)/dashboard/page.tsx:83-85` | Counts done by fetching every row's `id` then `.length` — 3 full-table scans for 3 integers | Use `db.$count(table, where)` or `select count(*)` |
| H8 | Performance | `src/lib/actions/bookings.ts:53`, `src/lib/actions/products.ts:36` | `nextReference()` fetches all references in the agency and finds max in JS on every create | Single `max(...)` aggregation query |
| H9 | Performance | `src/lib/actions/products.ts:57-67` | `recalcTotals()` issues one sequential UPDATE per item (N+1 writes) | Batch CASE-WHEN update or `Promise.all` parallel updates |
| H10 | Performance | `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/finance/page.tsx` | No Suspense boundaries; user sees blank screen until all DB queries finish (finance loads 1,000 bookings first) | Split into shell + Suspense async sections; add `loading.tsx` to finance |
| H11 | UX / RTL | `src/components/app/app-shell.tsx:223` | Mobile nav drawer hardcodes `slide-in-from-left-2` / `left-0` / `border-r` → appears from wrong side in Arabic (RTL) | Conditional `rtl:` variants or `dir`-based class switch (see UX 6.1/6.3) |
| H12 | UX / A11y | All auth forms (`sign-in-button.tsx:83`, `sign-up-form.tsx:107`, `forgot-password-form.tsx:70`, `reset-password-form.tsx:25,100`, `accept-invite-form.tsx:99`) | Error `<p>` has no `role="alert"`/`aria-live` → screen readers never announce login failures | Add `role="alert"` to error paragraphs |
| H13 | Database | `src/lib/schema.ts:188-198` (`verification` table) | No index on `verification.identifier` → full scan on every login/OTP check | Add `index("verification_identifier_idx").on(table.identifier)` + migration |

## Medium Severity Issues

| # | Category | File | Issue | Fix |
|---|---|---|---|---|
| M1 | Security | `src/lib/actions/commissions.ts:28-31,74-76` | `recordCommission` does not cross-tenant validate `supplierId`, `bookingItemId`, `agentUserId` | Add ownership checks scoped to `user.agencyId` before INSERT |
| M2 | Security | `src/lib/notifications/templates.ts:14,52-72` | User strings (`clientName`, `agencyName`, `roleLabel`) interpolated into HTML email without escaping | Add `h()` HTML-escape helper, apply to all user-sourced values |
| M3 | Security | `src/lib/storage.ts:117` | File upload validates extension only, not MIME magic bytes; SVG payloads accepted; risky on local-fs fallback path | Add `file-type` magic-byte check; reject SVG for user images |
| M4 | Error Handling | `src/lib/actions/commissions.ts:505-508` | `autoGenerateCommissions` failure swallowed with `console.error`; booking advances with no commissions and no warning | Return structured result; surface non-blocking toast warning |
| M5 | Error Handling | `src/lib/actions/platform.ts:134-136` | Stripe customer-create failure only logged; agency saved without `stripeCustomerId` → later "Agency not found" or duplicate customers | Structured log + flag/alert for reconciliation |
| M6 | Error Handling | `src/lib/suppliers/index.ts:78-97` (`safeSearch`) | `degraded: true` from mock fallback not forwarded to AI in chat route (`api/chat/route.ts:96-101`) → mock prices presented as real | Include `source`/`degraded` in tool result |
| M7 | Error Handling | entire `src/` | No structured logging library; only `console.error(string)` → cannot query/alert per tenant or correlate digests | Adopt Pino/Sentry or JSON-line logging convention |
| M8 | Performance | `src/lib/actions/bookings.ts:459-468` | `advanceStatus` ticketing loop: sequential external API + DB write per item | `Promise.all` the supplier calls; batch DB writes |
| M9 | Performance | `src/lib/actions/commissions.ts:258-277` | `getCommissions()` has no `.limit()` → unbounded result set | Add `.limit(500)` + pagination |
| M10 | Performance | `src/app/(app)/dashboard/page.tsx:109` | Loads up to 500 bookings with payments+travellers to compute KPIs in JS | Move aggregations to SQL; scope traveller query to passport alerts only |
| M11 | Performance | `src/app/(app)/finance/page.tsx:74` | Loads up to 1,000 bookings+payments; KPIs computed via JS reductions | Replace with SQL SUM aggregates; load AR rows only when balance > 0 |
| M12 | Performance | `src/lib/schema.ts` | Missing composite indexes for `(agencyId, status)` / `(agencyId, createdAt)` on booking, opportunity, product, commission | Add composite indexes + migrate |
| M13 | Performance | `src/lib/export/datasets.ts:74+` | Export loaders are unbounded `findMany` → OOM/timeout on large agencies | Per-dataset limits or streaming export |
| M14 | Performance | `src/components/app/app-shell.tsx:1` | Entire nav shell is `"use client"` only for `usePathname()` | Extract active-link logic to tiny `<NavLink>`; keep shell as server component |
| M15 | Performance | `src/app/(app)/dashboard/page.tsx:33` | Recharts (~150KB) eagerly imported for all users | `next/dynamic` `{ ssr:false }` chart imports |
| M16 | Performance | `src/components/hotels/hotel-details-view.tsx:221`, `src/components/search/hotel-details-dialog.tsx:123` | Raw `<img>` bypassing `next/image` optimization | Use `next/image` + add Hotelbeds CDN to `images.remotePatterns` |
| M17 | Code Quality | 9+ files (`billing.ts`, `invites.ts`, `payments.ts`, `portal-payments.ts`, `portal-invite.ts`, `api/portal/auth/request/route.ts`, `robots.ts`, `sitemap.ts`, `auth-client.ts`) | `NEXT_PUBLIC_APP_URL ?? "localhost:3000"` duplicated, bypassing `env.ts` | Export single `APP_URL` from `config.ts` |
| M18 | Code Quality | `src/lib/suppliers/` vs `src/lib/suppliers/providers/` | Two parallel supplier abstractions coexist; `providers/` registry is empty and unused | Mark `providers/` in-progress or complete migration and remove old layer |
| M19 | Code Quality | `src/lib/actions/**/*.ts` | 62 of 94 exported server actions lack explicit return-type annotations | Annotate with `: Promise<ActionResult>` |
| M20 | UX / A11y | `client-form.tsx:62`, `booking-form.tsx:87`, `opportunity-form.tsx` | Server errors only via auto-dismissing toast, no persistent inline error | Add `serverError` state + `role="alert"` inline message |
| M21 | UX / A11y | All forms | `aria-invalid` never set on fields after failed validation | Set `aria-invalid` on empty/invalid required fields |
| M22 | UX / A11y | `clients/page.tsx:92`, `suppliers/page.tsx:85` | Search `<Input>` has no `<Label>` (placeholder is not an accessible name) | Add `<Label htmlFor="q" className="sr-only">` |
| M23 | UX / A11y | `mode-toggle.tsx:19`, `create-agency-form.tsx:66`, `travellers-manager.tsx:303`, `payments-manager.tsx:227` | Icon-only buttons missing `aria-label`/`aria-haspopup`; save buttons lack `aria-busy` | Add `aria-label`, `aria-haspopup="menu"`, `aria-busy` |
| M24 | UX / RTL | ~62 `mr-`/`ml-` + ~94 `pl-`/`pr-`/`border-l`/`border-r` across components | Physical CSS directions don't flip in RTL | Refactor to logical `me-`/`ms-`/`ps-`/`pe-`/`border-s`/`border-e` |
| M25 | UX / RTL | List pages with tables (`clients`, `bookings`, `products`, `suppliers`) | `text-right` numeric columns don't flip in RTL | Replace with `text-end` |
| M26 | Database | `src/lib/schema.ts` | No `createdAt` index on booking/client/opportunity/product/payment/notification | Add `createdAt` indexes (priority: booking > client > opportunity > product > payment) |
| M27 | Database | `src/lib/schema.ts:423,510-536` | `bookingItem.supplierId` / `productItem.supplierId` FKs have no index → full scans in commission/supplier joins | Add `supplierId` indexes on both tables |
| M28 | Database | `src/lib/schema.ts` | No soft-delete (`deletedAt`) anywhere; hard deletes orphan commissions, no undelete/audit | Add `deletedAt` to client/booking/opportunity/product; filter list queries |
| M29 | Database | `src/lib/schema.ts:985-1001` | `supplierRate` has no denormalized `agencyId` → direct agency-scoped queries need double join | Add `agencyId` FK + index (matches `supplierContract` pattern) |
| M30 | Database | `src/lib/actions/bookings.ts:65-78` | `recalcTotal(bookingId)` queries `bookingItem` by `bookingId` with no agency scope (footgun if called with attacker-controlled id) | Pass `agencyId` and join/filter `booking.agencyId`, or accept pre-loaded items |

## Low Severity Issues / Recommendations

| # | Category | File | Issue | Fix |
|---|---|---|---|---|
| L1 | Security | `src/proxy.ts` matcher | `/suppliers`, `/finance`, `/reports`, `/settings`, `/billing`, `/commissions` not in matcher (still safe via `requireAgencyUser`) | Add routes to matcher for fast redirect |
| L2 | Security | `src/app/api/portal/auth/request/route.ts` | No rate limiting on magic-link request → resource exhaustion / enumeration | Add rate limit; delete existing unexpired tokens before insert |
| L3 | Security | `src/lib/actions/settings.ts:21-27` | Locale cookie `httpOnly:false` (intentional; validated via `isLocale()`) | No change; document risk |
| L4 | Error Handling | `src/lib/actions/settings.ts:34,65` | Empty `catch {}` with no logging | Add debug log in non-prod |
| L5 | Error Handling | `src/lib/suppliers/hotelbeds.ts:467` | Silent `catch {}` on availability fallback | `console.error("[hotelbeds] availability failed", err)` |
| L6 | Error Handling | `src/lib/suppliers/content-cache.ts:110,121` | `.catch(() => {})` silent cache-write swallow → cache never heals | Log the error |
| L7 | Error Handling | clipboard handlers `ai-quote-builder.tsx:79`, `itinerary-builder.tsx:306,340`, `payments-manager.tsx:95` | Silent clipboard catch after success toast → "copied!" shown even on failure | `.catch(() => toast.warning("Could not copy"))` |
| L8 | Error Handling | `src/app/error.tsx:16-17` | `error.digest` shown in UI but not logged server-side → can't correlate | Log `error.digest` (or Sentry capture) |
| L9 | Performance | `src/lib/actions/commissions.ts:284-309` | `getCommissionsByBooking()` does two sequential queries | Combine into one JOIN scoped by agency + booking |
| L10 | Performance | `src/app/layout.tsx:54` | All i18n messages shipped to every client | Scope messages per page |
| L11 | Performance | `src/app/proposal/[id]/page.tsx`, public token pages | No ISR/revalidate on public proposal pages | `export const revalidate = 60` on public-facing pages |
| L12 | Code Quality | `src/lib/session.ts` | Entire file is dead code (`requireAuth`, `getOptionalSession`, stale `protectedRoutes`) | Delete file |
| L13 | Code Quality | `src/proxy.ts` | Middleware never executes (not `middleware.ts`, no `middleware`/default export) → manifest empty | Rename to `src/middleware.ts` + export `middleware`, or delete |
| L14 | Code Quality | `src/components/ui/github-stars.tsx` | Exported component with zero consumers | Delete |
| L15 | Code Quality | `portal-session.ts:20`, `settings.ts:24,60`, `platform.ts:200,228` | `secure: NODE_ENV==="production"` duplicated 5× | Export `isProduction` from `config.ts` |
| L16 | Code Quality | `analytics.ts:62`, `finance/page.tsx:176` | `Intl.DateTimeFormat("en-GB",{month:"short"})` duplicated | Add `formatShortMonth()` to `format.ts` |
| L17 | Code Quality | `permissions.ts:53,193` | `session.user as unknown as {...}` cast duplicated | Extract `extractUser()` helper |
| L18 | Code Quality | `hotelbeds.ts:81`, `add-to-booking-dialog.tsx:67`, `add-to-proposal-dialog.tsx:57`, `payments-manager.tsx:97`, `hotel-details-view.tsx:297` | Non-null assertions without guard | Use optional chaining / narrowing |
| L19 | Code Quality | `api/portal/auth/request/route.ts:67`, `notifications/email.ts:30` | `console.log` violates `no-console` ESLint rule (warn/error only) | Use `console.error` or guard behind dev env |
| L20 | UX / A11y | `hotel-search-experience.tsx:222-228` | Search button loses label text + no `aria-label` while loading | Add `aria-label="Searching…"` |
| L21 | UX / Mobile | Table wrappers in list pages | No visual scroll hint on overflowing tables | Add scroll-shadow mask |
| L22 | UX / Mobile | `pipeline-board.tsx:101-108` | Stage-move trigger ~20px touch target (< WCAG 44px) | `p-1.5` or `min-w/min-h-[44px]` |
| L23 | UX / A11y | `hotel-details-view.tsx:221`, `hotel-details-dialog.tsx:123` | Gallery images use empty `alt=""` though not purely decorative | Descriptive alt text |
| L24 | UX / A11y | `portal/layout.tsx:25` | `<nav>` missing `aria-label` | `aria-label="Portal navigation"` |
| L25 | Code Quality | `billing/stripe.ts:17`, `payments/stripe.ts:9` | `isBillingConfigured()`/`isStripeConfigured()` identical | Document separation or share one |
| L26 | Database | `src/lib/schema.ts:1023-1025` | `commission.bookingItemId` uses `ON DELETE SET NULL` → orphaned, unreconcilable commissions | Change to `ON DELETE CASCADE` |
| L27 | Database | `src/lib/schema.ts:652-868` | Missing Drizzle `relations` for `supplier`, `supplierContract`, `supplierRate`, `commission` → breaks `with:` eager loads | Add relations + `agencyRelations` entries |
| L28 | Database | `drizzle/0006_add_agency_tenancy.sql:343` | Unconditional backfill could set platform-admin `agencyId` to seed agency (non-issue in practice, all `is_platform_admin=false` then) | Document; corrective migration if needed |
| L29 | Database | `src/lib/schema.ts:882-906` | `hotelContent` uses `text("code")` PK (justified natural key) | Add clarifying comment re AGENTS.md UUID exemption |
| L30 | Database | `payment`, `bookingTraveller` and other child tables | No denormalized `agencyId` (defense-in-depth gap) | Consider `agencyId` on `payment` (financial) + `bookingTraveller` (PII) |

## Category Findings

### 1. Security

Overall posture is solid: `agencyId` is always server-derived from `session.user.agencyId`, every action calls `requireAgencyUser()`/`requireUser()`/`requirePlatformAdmin()`/`requireManager()` first, all mutations use `and(eq(id), eq(agencyId))` double-conditions, all inputs are Zod-validated, Drizzle parameterizes all queries, no secrets are in `NEXT_PUBLIC_`, no `dangerouslySetInnerHTML`, Stripe webhooks verify signatures, impersonation gates on `requirePlatformAdmin()` with `httpOnly` cookies, portal actions verify `clientId + agencyId`, and invite registration ties `agencyId`/`role` to the invite row (`input:false`).

- **H1 — Prompt injection via `role:"system"`** (`api/chat/route.ts:28-36`): client can POST `system` messages that flow into `convertToModelMessages` and override the server system prompt, including triggering `createBooking`. Restrict the enum to `["user","assistant"]`.
- **H2 — CSRF forced-logout** (`api/portal/auth/signout/route.ts:2,15`, `portal/layout.tsx:39`): `GET` signout via `<a href>` is exploitable with `<img src=...>`. Switch to `POST` + form. Impact limited to DoS but CWE-352.
- **M1 — Commission FK cross-tenant** (`commissions.ts:28-31,74-76`): `bookingId` is validated but `supplierId`/`bookingItemId`/`agentUserId` are not, allowing foreign-tenant FK references and an existence oracle.
- **M2 — Unescaped HTML email** (`notifications/templates.ts`): `clientName`/`agencyName`/`roleLabel` interpolated raw; low risk in mail clients but the same names render on admin pages.
- **M3 — Extension-only upload validation** (`storage.ts:117`): no magic-byte check; SVG/script payloads accepted; risky on local-fs fallback.
- **L1** missing middleware matcher routes, **L2** no rate limit on magic-link request, **L3** intentional non-`httpOnly` locale cookie (validated).

### 2. Error Handling

This is the weakest category and the source of both blockers.

- **C1 — Fake PNR fallback** (`duffel.ts:278`, `bookings.ts:382`): the single most dangerous behavior in the app. A failed airline booking is recorded as `confirmed` with a provisional `DF-` reference and no agent-visible warning — agents could issue tickets against a non-existent booking.
- **C2 — Webhook DB writes unguarded** (`stripe/webhook/route.ts:75-86`, `connect-webhook/route.ts:40-46`): DB throw → 500 → Stripe retry storm with duplicate side-effects; `connect-webhook` returns 400 on misconfig (stops legitimate retries).
- **H3 — No try/catch in 10 action files**; **H4 — chat route + tools unguarded**; **H5 — no fetch timeouts** on Duffel/Hotelbeds/Stripe (hang to Vercel 30s); **H6 — missing `error.tsx`** in portal/platform/bookings/clients (root boundary sends portal clients to inaccessible `/`).
- Medium: **M4** silent commission auto-gen failure, **M5** Stripe customer-create failure unsurfaced, **M6** `degraded` flag not forwarded to AI, **M7** no structured logging.
- Low: **L4-L8** silent/empty catches and missing digest logging.

### 3. Performance

No catastrophic issues but several scale time-bombs as agencies grow.

- **H7** dashboard counts via full fetch + `.length`; **H8** `nextReference()` fetches all references per create; **H9** `recalcTotals()` N+1 UPDATEs; **H10** no Suspense → blank screen on dashboard/finance (finance loads 1,000 bookings first, has no `loading.tsx`).
- Medium: **M8** serial ticketing API/DB loop, **M9** unbounded `getCommissions()`, **M10/M11** large in-memory KPI computation on dashboard (500 bookings) and finance (1,000 bookings) that should be SQL aggregates, **M12** missing composite indexes, **M13** unbounded export → OOM, **M14** unnecessarily-client AppShell, **M15** eager Recharts ~150KB, **M16** raw `<img>`.
- Low: **L9** sequential commission-by-booking queries, **L10** full i18n payload per client, **L11** no ISR on public proposals.

### 4. Code Quality

Clean of TODO/FIXME/HACK markers; main issues are dead code and duplication.

- Dead code: **L12** `session.ts` (entire file), **L13** `proxy.ts` (middleware never executes — wrong filename/export), **L14** `github-stars.tsx`.
- Duplication: **M17** `APP_URL` fallback in 9+ files, **L15** `secure` cookie option ×5, **L16** `SHORT_MONTH` formatter, **L17** `session.user` cast ×2, **L25** identical Stripe-configured sentinels.
- Architecture: **M18** two parallel supplier systems (`suppliers/` live vs empty `suppliers/providers/`).
- Types: **M19** 62/94 actions lack return-type annotations; **L18** 5 unguarded non-null assertions; **L19** 2 `console.log` ESLint violations.

### 5. UX & Accessibility

Strongest gaps are RTL (Arabic) breakage and screen-reader announcements.

- **H11/H12** — mobile drawer slides from the wrong side in RTL (`app-shell.tsx:223`); auth error `<p>`s lack `role="alert"`.
- RTL: **M24** ~156 physical-direction utilities should be logical (`me-`/`ms-`/`ps-`/`pe-`/`border-s`/`border-e`); **M25** `text-right` → `text-end` on numeric table columns.
- Forms: **M20** errors only via dismissible toast, **M21** `aria-invalid` never set, **M22** search inputs missing `<Label>`.
- A11y: **M23** icon-only buttons missing `aria-label`/`aria-haspopup`/`aria-busy` (`mode-toggle`, `create-agency-form`, `travellers-manager`, `payments-manager`).
- Loading: **L1.1** 6 list pages have no `loading.tsx` skeleton; low-severity **L20-L24** scroll hint, touch target, gallery alt, nav label.

### 6. Database

Schema is well-structured with consistent UUID PKs and tenant scoping; gaps are indexing and soft-delete.

- **H13** — no index on `verification.identifier` (full scan every login).
- Indexing: **M26** missing `createdAt` indexes on high-volume tables, **M27** missing `supplierId` indexes on `bookingItem`/`productItem`, **M12** missing `(agencyId, status)` composites.
- Tenant isolation: **M29** `supplierRate` missing denormalized `agencyId`; **M30** `recalcTotal` queries `bookingItem` without agency scope (footgun); **L30** child tables (`payment`, `bookingTraveller`) lack defense-in-depth `agencyId`.
- Data lifecycle: **M28** no soft-delete anywhere; **L26** `commission.bookingItemId` `SET NULL` orphans commissions.
- Hygiene: **L27** missing relations for supplier/commission tables, **L28** migration 0006 backfill edge case, **L29** `hotelContent` text PK (justified).

## Files That Need Immediate Attention

1. **`src/lib/suppliers/duffel.ts`** — C1 (fake PNR), H5 (no fetch timeout), L5/L18 — the highest-risk file; fake-booking behavior is a business blocker.
2. **`src/app/api/stripe/webhook/route.ts`** + **`connect-webhook/route.ts`** — C2 (unguarded DB writes → retry storm).
3. **`src/lib/actions/bookings.ts`** — C1 (confirmed status on provisional), H8 (`nextReference`), M8 (serial ticketing), M30 (`recalcTotal` scope).
4. **`src/app/api/chat/route.ts`** — H1 (prompt injection), H4 (no try/catch), M6 (degraded flag).
5. **`src/components/app/app-shell.tsx`** — H11 (RTL drawer), M14 (client component), M24 (logical props).
6. **`src/app/(app)/dashboard/page.tsx`** — H7 (count via fetch), H10 (no Suspense), M10/M15.
7. **`src/app/(app)/finance/page.tsx`** — H10 (no Suspense/loading), M11 (1,000-row JS KPIs).
8. **`src/lib/schema.ts`** — H13 (verification index), M12/M26/M27/M28/M29, L26/L27.
9. **`src/lib/actions/commissions.ts`** — M1 (cross-tenant FK), M4 (silent failure), M9 (no limit), L9.
10. **`src/lib/actions/products.ts`** — H8 (`nextReference`), H9 (N+1 `recalcTotals`).
11. **Auth form components** (sign-in/sign-up/forgot/reset/accept-invite) — H12 (`role="alert"`), M21.

## Remaining Recommendations

- Adopt a structured logging / observability layer (Pino + Vercel log drain, or Sentry) so per-tenant error rates can be alerted on and user-visible `error.digest` values correlate with server logs (**M7**, **L8**).
- Add rate limiting (Upstash or token bucket) to the magic-link request endpoint and any other unauthenticated POST endpoints (**L2**).
- Introduce a soft-delete strategy (`deletedAt`) on core entities for audit/undelete before data volume makes retrofitting expensive (**M28**).
- Complete or formally retire the `suppliers/providers/` registry to remove the dual-abstraction ambiguity (**M18**).
- Centralize repeated config (`APP_URL`, `isProduction`, `formatShortMonth`) in `config.ts`/`format.ts` and delete confirmed dead code (`session.ts`, `proxy.ts` or rename, `github-stars.tsx`) (**M17**, **L12-L17**).
- Run a single RTL refactor pass converting physical to logical Tailwind utilities across components, and add `loading.tsx` skeletons to the six list pages lacking them (**M24**, **L1.1**).
- Annotate all server actions with explicit `Promise<ActionResult>` return types to catch accidental return-shape drift in CI (**M19**).
- After schema index/FK changes, run `drizzle-kit generate && migrate` (never `push`, per AGENTS.md).

---

## Remediation Applied (2026-06-28)

Implemented via parallel coder sub-agents, each owning a disjoint file set.
Verification: `npx tsc --noEmit` clean · `npm run lint` 0 errors (48 pre-existing
import-order warnings only) · `npx next build` all routes compile.

### Critical
- **C1 — Fake-PNR fallback** — `duffel.ts` no longer fabricates a `DF-…`
  reference; `bookFlight` throws on provider failure. `bookings.ts`
  `confirmItemBooking` returns a discriminated result; failed items are set to
  `pending` (existing enum value), never `confirmed`. `advanceStatus` aborts the
  ticketing advance and returns `{ ok:false, reasons }` if any item failed.
  Files: `src/lib/suppliers/duffel.ts`, `src/lib/actions/bookings.ts`.
- **C2 — Stripe webhook retry storm** — DB writes wrapped in try/catch in both
  `webhook/route.ts` and `connect-webhook/route.ts`; misconfiguration in
  connect-webhook now returns 503 (was 400) so Stripe retries; signature
  failures stay 400; transient DB errors return 500 with logging.

### High
- **H1** chat role enum restricted to `["user","assistant"]` (no client `system`).
- **H2** portal signout changed GET→POST + `<form method="POST">` (303 redirect).
- **H3** try/catch + `console.error` + friendly error returns added across 10
  action files (clients, team, suppliers, invites, opportunities,
  portal-proposals, notifications, proposals-public, portal-invite, onboarding)
  and commissions.
- **H4** chat `streamText` + every tool `execute` wrapped; `createBooking`
  collects failed items/travellers instead of silently skipping.
- **H5** 15s `AbortController` fetch timeouts on Duffel, Hotelbeds, Stripe wrappers.
- **H6** segment `error.tsx` added for `portal/` (→ /portal/login), `(app)/`
  (→ /dashboard), `platform/` (→ /platform).
- **H7** dashboard counts now use `db.$count(...)` instead of fetch + `.length`.
- **H8** `nextReference()` uses a single `max(...)` aggregate.
- **H9** `recalcTotals()` N+1 UPDATEs replaced with `Promise.all`.
- **H10** Suspense around dashboard insights + new `finance/loading.tsx` skeleton.
- **H11** mobile drawer made RTL-aware via Tailwind `rtl:` variants.
- **H12** `role="alert"` added to all auth-form error messages.
- **H13** `verification_identifier_idx` added (in migration 0018, pending apply).

### Medium / Low (included in tranche)
- **M1** commissions `recordCommission` now cross-tenant-validates
  `supplierId`/`bookingItemId`/`agentUserId` before insert.
- **M2** `escapeHtml()` applied to user-sourced values in email templates.
- **M6** `degraded`/`source` flag now part of `safeSearch` result type and
  forwarded to the AI chat tools (mock prices disclosable).
- **M12/M26/M27/L26/L27** composite + createdAt + supplierId indexes,
  commission cascade, and supplier/commission Drizzle relations — all in
  `drizzle/0018_regular_karnak.sql` (**pending apply** — see blocker above).
- **M30** `recalcTotal` now agency-scoped via join on `booking.agencyId`.
- **L12/L13/L14** deleted dead code: `src/lib/session.ts`, `src/proxy.ts`
  (dormant non-executing middleware; protections already enforced by
  `requireAgencyUser()`), `src/components/ui/github-stars.tsx`.

### Deferred (explicitly out of this tranche — recommend follow-up)
- **M28** soft-delete (`deletedAt`) strategy across core entities.
- **M18** retire/complete the dual `suppliers/providers/` abstraction.
- **M24/M25** full RTL refactor (~156 physical→logical Tailwind utilities).
- **M7** structured logging/observability (Pino/Sentry).
- **L2** rate limiting on the magic-link request endpoint.
- Remaining Medium/Low UX, a11y, and perf items per the tables above.

### Action required to fully close
1. Refresh `POSTGRES_URL` in `.env` (dev) with a valid Neon password, then run
   `npx drizzle-kit migrate` to apply `0018_regular_karnak.sql`.
2. Apply the same migration to **prod**:
   `POSTGRES_URL=<prod-url> npx drizzle-kit migrate`.
