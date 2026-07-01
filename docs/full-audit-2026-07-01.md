# Full Codebase Audit — 2026-07-01

Five-dimension audit (security · correctness · database/schema · UI/design-system ·
docs-vs-code) run by parallel deep-dive agents, plus the quality gates. Read-only:
no fixes were applied. Each finding was verified against the actual code with
file:line evidence by the auditing agent.

**Quality gates: all green.** `pnpm lint` ✅ · `pnpm typecheck` ✅ · `next build` ✅ (0 errors).

---

## Priority punch list (cross-dimension, ranked)

| # | Sev | Finding | Where | Dimension |
|---|---|---|---|---|
| 1 | **Critical** | Ticketing a proposal-converted booking crashes: auto-created items have `details = null`, and `serviceBookFlight`/`serviceBookHotel` deref `offer.rawOfferId` on it → uncaught TypeError, booking stuck | `src/lib/actions/bookings.ts:429,445` + `src/lib/suppliers/booking-service.ts:125,280` | Correctness |
| 2 | **High** | `setBookingStatus` (status dropdown) bypasses all lifecycle guards — a zero-item, unpaid booking can jump to `ticketed`/`completed`, and commissions silently never generate | `src/lib/actions/bookings.ts:252-302` + `booking-status-control.tsx:37-40` | Correctness |
| 3 | **High** | `recordPayment` / `deletePayment` / `createPaymentLink` never check `canManagePayments` — an **agent** can fabricate/delete payments and mint Stripe links via direct server-action POST | `src/lib/actions/payments.ts:35,76,95` | Security |
| 4 | **High** | Double supplier booking on retry: idempotency replay guard only short-circuits `status==='success'`; a `pending` row (serverless timeout mid-call) falls through and re-books at the supplier → double PNR/charge | `src/lib/suppliers/booking-service.ts:129-220` | Correctness |
| 5 | **High** | `commission.bookingId` is `onDelete: cascade` — hard-deleting a booking silently destroys earned/paid commission ledger rows (financial history, no soft delete to recover) | `src/lib/schema.ts:1269-1271` | Database |
| 6 | **High** | `booking_idempotency` has no cleanup job and the cache-read never checks `expiresAt` — table grows forever and "expired" keys are still served as cache hits | `src/lib/schema.ts:800-806` + `booking-service.ts:129`; `vercel.json` has no crons | Database |
| 7 | **Med-High** | Proposal accept race: public-token and portal accept paths both pass the non-transactional `acceptedAt` guard → second signer overwrites the first's name/IP/signature (audit-trail corruption). Booking idempotency latch itself holds | `src/lib/actions/proposals-public.ts:118`, `portal-proposals.ts:113`, `bookings.ts:1069-1096` | Correctness |
| 8 | **Medium** | Commission read actions (`getCommissions`, `getCommissionsByBooking`, `getCommissionSummary`) not gated by `canViewFinance` — an agent can read the full agency commission ledger via direct POST (same-tenant only) | `src/lib/actions/commissions.ts:301,344,384` | Security |
| 9 | **Medium** | `parseFloat` NaN can poison totals: `paymentSummary` and `recalcTotal` lack the finite guard `analytics.num()` has — one malformed amount writes `"NaN"` into `booking.totalAmount` | `src/lib/payments/summary.ts:15`, `src/lib/actions/bookings.ts:84` | Correctness |
| 10 | **Medium** | Reports "Revenue" and funnel window on `createdAt`, not confirmation/payment date — long-cycle bookings are invisible in the period they're actually paid (undercounts MTD/QTD) | `src/components/reports/reports-analytics.tsx:149-152,298-302` | Correctness |
| 11 | **Medium** | Provider registry `pick()` trusts the declared `capabilities` array without applying the runtime type-guards — a misdeclared provider silently degrades booking to provisional refs | `src/lib/suppliers/providers/registry.ts:106-121` | Correctness |
| 12 | **Medium** | 30 raw `badgeClass` status strings in `domain.ts` flow through 13 legacy `StatusBadge tone=` call sites, bypassing `statusTone()` — the single root cause of deprecated status-color usage | `src/lib/domain.ts:23-244` + 13 call sites (see UI section) | UI |
| 13 | **Low** | Portal magic-link token doubles as a session bearer for its 15-min window (same `token` column, no purpose discriminator); old magic tokens also never invalidated/GC'd | `api/portal/auth/request/route.ts:43-50`, `src/lib/portal-session.ts:33` | Security |
| 14 | **Low** | `supplier` / `supplier_contract` / `commission` declare `updatedAt` without `$onUpdate()` — staleness whenever a writer forgets to set it manually | `src/lib/schema.ts:1188,1225,1304` | Database |

Suggested remediation order: **1 → 2 → 3 → 4 → 5/6** (crash + financial-control
bypass + double-charge + data loss), then 7–11, then the UI/docs cleanups below.

---

## 1. Security

**Verdict: unusually disciplined multi-tenant hygiene; 1 High, 1 Medium, 2 Low.**

Findings:
- **High — payment mutations unguarded** (#3 above). Fix: add
  `canManagePayments(user.role)` after `requireAgencyUser()` in all three
  functions, mirroring `commissions.ts`.
- **Medium — commission reads unguarded** (#8). Fix: `canViewFinance` check at the
  top of each read.
- **Low — magic token = session bearer** (#13). Fix: `kind`/`purpose` column (or
  separate table) so `getPortalSession()` only accepts `session`-purpose rows.
- **Low — magic tokens accumulate**: each portal-login request inserts a new row;
  prior unexpired ones stay valid. Fix: expire prior pending rows on issue.

Verified clean (evidence-checked, not assumed):
- **Tenant isolation** — every child mutation across all action files uses the
  double-constraint pattern (`and(childId, parent.agencyId)`); no `findFirst(id)`-only
  mutation path found. Token routes (`/p/`, `/i/`, booking-docs) properly scoped;
  `createBookingFromAcceptedProposal` derives tenant from `product.agencyId` only.
- **Export API** — `requireAgencyUser` + `canViewFinance` + per-dataset agency scope.
- **AI surface** — `role:"system"` rejected, tools hard-scoped server-side, prompt
  injection cannot reach cross-tenant reads or unscoped mutations.
- **Stripe webhooks** — raw body, timing-safe compare, 300 s replay window, correct
  retry-status semantics on both routes.
- **XSS/SSRF/redirects/secrets** — no `dangerouslySetInnerHTML`, parameterized SQL
  only, no user-controlled fetch targets, no hardcoded secrets in `src/`,
  internal-only redirects. Impersonation cookies honored only for
  `isPlatformAdmin`. Portal signout is POST-only (CSRF-hardened).

## 2. Correctness

**Verdict: money math and currency isolation are solid; the booking lifecycle has real bugs.**

Beyond punch-list items #1, #2, #4, #7, #9, #10, #11:
- **Low** — AR aging labels overlap contents by a day (`0–30d` includes day 30,
  `30–60d` starts at 31): relabel `0–30 / 31–60 / 61+` (`src/lib/analytics.ts:155`).
- **Low** — `growthPct` renders 0→N as "+100%", indistinguishable from a true
  doubling (`src/lib/analytics.ts:51-54`).
- **Note** — `autoGenerateCommissions` idempotency guard is correct but
  non-transactional; a concurrent double-advance could theoretically double-insert.

Verified clean: `period.ts` half-open windows + like-for-like prev baselines;
`sumByCurrency`/`headlineTotal` never blend currencies; export datasets
agency-scoped with correct `paymentSummary` reuse; finance page DZD headline logic;
`nextReference` collision-safe.

## 3. Database / schema

**Verdict: migration hygiene, tenancy coverage, uniques, and money types all verified clean; the risks are lifecycle/ops.**

Beyond punch-list items #5, #6, #14:
- `agency_invite` and `portal_session` expired rows are also never swept (fold
  into the same cron as #6).
- Missing FK indexes: `commission.bookingItemId`, `commission.supplierId`,
  `product.convertedBookingId` (seq scans on cascade/joins).
- Optional: composite `payment(bookingId, createdAt)` index.
- All enum-like columns are unconstrained `text` (documented choice — noted, not a bug).

Verified TRUE as documented: no soft delete anywhere; `reference` only on
booking+product; 21 migrations `0000–0020` with a consistent journal and **no
un-migrated schema drift**; per-agency uniques + shareToken uniques present;
`booking_event`/`supplier_contract` denormalize `agencyId` as claimed; all money
columns `numeric(12,2)`; every business table has a tenancy path.

## 4. UI / design system

**Verdict: token/radius/shadow discipline is clean; status-color debt is concentrated in one root cause; the "systemic five" page gaps persist.**

- **SEV-1 (root cause)** — `domain.ts` `badgeClass` strings + 13 legacy `tone=`
  call sites (clients ×3, products ×3, opportunities, team ×2, support ×2,
  platform ×2, commissions-manager). One refactor to `StatusPill`/`statusTone()`
  clears the whole class.
- **SEV-2 (~9 component violations)** — impersonation banner (`(app)/layout.tsx:45`),
  `stat-card.tsx:54` delta chip, search-workspace "refundable" pills (606, 623),
  `getting-started-card.tsx:64`, `assistant/page.tsx:248`, `booking-documents.tsx:30-32`,
  pipeline-board 484/486, invoice print doc (tolerated but inconsistent).
- **Acceptable decorative** (not violations): star ratings, avatar hues, airline
  brand gradients, portal avatar palette.
- **Page checklist matrix (6 list pages)** — Search/Filters/Export/Empty/Loading/
  Permissions: ✅ across the board. **Bulk actions 0/6. Real pagination 0/6**
  (hardcoded `.limit()` caps — the documented silent-cap anti-pattern).
  **Mobile card-reflow 1/6** (only bookings). **`error.tsx` 3 route-level files**
  (root, assistant, bookings) vs **24 `loading.tsx`**.
- **Tables** — `bookings-table.tsx` is the model citizen; raw `<table>` markup in
  assistant (markdown renderer, acceptable), pipeline-board, and
  hotel-search-experience. Commissions money columns light on `tabular-nums`.
- **Misc** — repeated `to-[#3E72E0]` logo-gradient hex (should be a token/class);
  `border-[#C9D8F6]` in flight-results; a few `ml-auto` → `ms-auto` in shell
  chrome; `.focus-ring` adopted in only 2 files.

## 5. Documentation accuracy

**Verdict: 14 confirmed discrepancies; in all but one the code is right and the doc is stale.**

Misleading / operationally risky:
1. **Dev Neon branch conflict** — `database.md`/`development-guide.md`/`atlas.md`
   say `ep-wandering-sunset-aitlty78`; `deployment.md` says `ep-dawn-voice-ai8d6q3o`.
   Code can't arbitrate (env-only; only prod `ep-misty-thunder-aixz34vy` is
   corroborated via `PROTECTED_DB_HOSTS`). Dangerous because dev has **no**
   destructive-script guard. → Verify against live Neon, unify all four docs.

Wrong (code contradicts doc):
2. `ai.md` assistant-tools table lists 5 tools; the route wires **14** (4 factory
   files + 5 inline).
3. `ai.md` claims EUR is the assistant's default currency; the system prompt uses
   **DZD** (EUR only forced on live search params).
4. `ai.md` blesses the inline-AI error string "Check that OPENROUTER_API_KEY is
   set" — a real stale string in `ai.ts` (Gemini is primary), which the doc should
   flag, not describe as intended.
5. `roadmap.md:208` "No Checkbox primitive exists" — it exists and is consumed.
6. `roadmap.md:209-210` loading/error coverage — actually 29 `loading.tsx` + 8
   `error.tsx` repo-wide (the app-route subset is 24/3, see UI section).
7. `roadmap.md` footer "Migrations: 19" — actual 21 files, latest `0020`.
8. `roadmap.md` open item #7 (add `convertedBookingId`) — shipped in `0020`; dead item.
9. `roadmap.md:240` dead ADR link `0006-deck-identity-adoption.md` — file doesn't
   exist (`0006` is auto-booking).

Stale / cosmetic:
10. `database.md` migration table ends at `0019` with an `0018 | (see existing)`
    placeholder; missing the `0020` row.
11. `architecture.md` supplier module list omits the whole `providers/` registry,
    `config.ts`, `booking-service.ts`, and `travel-platform/`.
12. `architecture.md` route map lists pre-redesign paths (`search`, `hotels`,
    `operations`) as canonical; they are now redirects to `sourcing/*` / `bookings`.
13. `deployment.md` demo table lists 3 agents; the seed creates 5 (yacine, nour missing).
14. OpenRouter default-model divergence (`gpt-5-mini` env/assistant vs hardcoded
    `gpt-4.1-mini` in `ai.ts`) — a **code** smell the docs faithfully report; unify in code.

Clean docs: `api-integrations.md`, `deployment.md` (modulo #1/#13),
`development-guide.md`, `atlas.md`, `DESIGN.md`, core of `architecture.md`.

---

## Adjacent code follow-ups surfaced by the docs audit

- Inline-AI failure message names only `OPENROUTER_API_KEY` — should name
  `GEMINI_API_KEY or OPENROUTER_API_KEY` (already fixed on the chat route).
- `ai.ts` hardcodes `openai/gpt-4.1-mini`, ignoring the `OPENROUTER_MODEL` env
  default (`openai/gpt-5-mini`) — unify on the env accessor.
