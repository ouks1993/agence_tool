# Roadmap & Changelog

## Phase status

**Phase 1 — Sellable ✅ COMPLETE**
Email (Resend) · Stripe SaaS billing · Separate Neon DB branches (dev/prod) · PDF
proposals · E-signature · Live flights (Duffel) · Live hotels (Hotelbeds + content
cache).

**Phase 2 — Competitive ✅ COMPLETE**
Supplier management (`/suppliers`, contracts, rates, picker) · Commissions
tracking (auto-generated, two-ledger, `/commissions`) · Client portal (magic-link
login, trip view, online payments via Stripe Connect, in-portal proposal signing +
portal invite from agent).

**Phase 3 — AI differentiation ✅ COMPLETE**
AI itinerary generation · AI quote builder · AI email drafting · AI visa
assistant — all inline, embedded where the work happens. See [ai.md](ai.md).

**UX overhaul ✅ COMPLETE** (20 changes across 4 size categories)
Getting-started checklist · Lifecycle stepper · Board view toggle · Inline search ·
Portal invite · Convert proposal→booking · Client funnel timeline · Booking hard
guards · Vocabulary pass · Role nav tooltips · Empty-state badges.

**Data quality & BI ✅ COMPLETE** (4 phases)
DZD-only currency (no FX) · **P1** richer analytics (revenue/conversion/pipeline
funnel/AR aging/margin) · **P2** controlled-vocabulary enums (7 fields,
codes+labels) · **P3** ISO country/nationality reference data + city suggestions ·
**P4** standardized CSV/Excel export (`/reports`, dual code+label columns). Hotel
search-by-name added. See [analytics.md](analytics.md).

## Module maturity

Maturity levels: **Production** (stable, in daily use) · **Beta** (works, hardening)
· **Alpha** (functional, evolving) · **Planned** (not built).

| Module | Status |
|---|---|
| CRM | Production |
| Sales | Production |
| Hotels | Beta |
| Flights | Beta |
| Accounting | Planned |
| AI | Alpha |
| Supplier Portal | Planned |

> **Flights/Hotels nuance:** live *search* is shipped for both (Duffel + Hotelbeds);
> the maturity above reflects the end-to-end **booking** flow — Hotels is further
> along (Beta), real Flights booking is Planned (Duffel orders). See
> [api-integrations.md](api-integrations.md) and Open item #1.

## UI redesign (phased) — ✅ COMPLETE

Brought the **live app** up to the marketing-grade standard set by the sales deck
and mockups under `marketing/` — a full visual/UX upgrade of **every one of the 55
routes**, shipped by phase, **preserving all functionality**. Follow-on polish added
a unified `StatStrip` KPI band app-wide. See the plan at
[specs/ui-redesign/PLAN.md](../specs/ui-redesign/PLAN.md) and the decision at
[docs/decisions/0005-app-ui-redesign.md](decisions/0005-app-ui-redesign.md).

| Phase | Scope | Status |
|---|---|---|
| 0 | Design foundation (tokens + primitives) + seed full demo data | ✅ done |
| 1 | Dashboard · CRM (list + profile) · Pipeline | ✅ done |
| 2 | Proposal builder · Flight search · Hotel search | ✅ done |
| 3 | Bookings & Booking details · Finance · Commissions | ✅ done |
| 4 | Customer portal · Reports · AI assistant | ✅ done |
| 5 | Responsive, empty/loading/error states, polish | ✅ done |

### Since the redesign
- **AI → Google Gemini** (primary; OpenRouter fallback). The `/assistant` gained
  tenant-safe read tools across **every data domain** (bookings, clients, proposals,
  pipeline, finance, commissions), a live client/booking context rail, and
  platform-admin "view as" scoping; provider/multi-turn/currency fixes along the way.
  See [ai.md](ai.md).
- **Auto-booking on proposal accept** — accepting + signing a proposal auto-creates a
  booking (`awaiting_payment`), idempotent + tenant-safe. `product.convertedBookingId`
  (migration `0020`). See [business-rules.md](business-rules.md) and
  [decision 0006](decisions/0006-auto-booking-on-proposal-accept.md).
- **Dashboard** deduped (removed 6 KPIs/panels that repeated the manager Insights) +
  an operational "act-today" band (departures 7d, proposals awaiting response,
  overdue, new clients) + a "closing this month" chart.

Marketing assets (deck + 11 mockups + demo dataset + design guide) live under
`marketing/` and are the visual target.

**Phase 1 delivery (command center).** Rebuilt Dashboard, CRM list + client
profile, and the Pipeline board to the mockup standard, reusing the Phase 0
primitives (StatCard deltas, insight charts) + three new shadcn primitives
(Tabs, Breadcrumb, Tooltip). **Delivery policy — redesign, not rewrite:** no
schema changes; any mockup field without a backing column is **derived from real
data** (lifetime value, trips, win rate, spend-by-year, MoM deltas, derived
follow-ups from balances/close-dates/passport alerts) or **omitted** — never
fabricated. Notable omissions (no backing data): client tags/loyalty/grade/
travel-preferences/Documents/Passport/Family tabs; opportunity reference ids and
per-stage micro-labels; the dashboard "Atlas suggests" AI card and free-text
tasks. This same derive-or-omit policy governs Phases 2–5.

**Phases 2–4 delivery (sell · operate · client experience).** Applied the command-
center system across the revenue, fulfilment, and client-facing surfaces, all
redesign-not-rewrite (no schema/logic changes; presentational + new-scaffold only):
- **Phase 2** — proposal builder (breadcrumb + sectioned card; line items got
  per-category colour tiles, per-line margin, a totals panel); flight search
  (airline logo tiles, elevated panel, loading skeleton, EmptyState); hotel search
  (same treatment). *Omitted:* the mockup's live proposal preview pane (net-new
  renderer — public `/p/[token]` view + server PDF already exist) and the flight
  sidebar-filter layout.
- **Phase 3** — bookings list KPI strip (counts only, no FX summing) + `loading.tsx`/
  `error.tsx`; booking-details (breadcrumb, derived KPI strip, card-elevated, finance
  hero with payment progress bar) via a map→plan→implement→verify workflow; finance
  (card-elevated charts/AR, EmptyState, row hover) + commissions (elevated table).
- **Phase 4** — customer portal (elevated/interactive cards, EmptyStates, balance
  hero) via a 4-page parallel workflow; reports export hub (per-dataset icon tiles);
  AI assistant (brand Bot tile, role icons, shadcn Input).
- **Verification:** build-gated (lint + tsc) on every commit; the heavier screens
  ran adversarial multi-agent review (regression + design + policy lenses) — which
  caught and fixed a real client-facing regression in the portal (a negative balance
  could be shown to a client). Visual/browser QA is still pending (local dev DB has
  no seeded user; signup is invite-only).
- **Docs:** DESIGN.md gained the amber "warning / amount-due" status colour (was
  undocumented despite wide use). i18n of new English labels on deeper pages is
  tracked under open-item #2 (translate deeper pages), consistent with those pages'
  pre-existing hardcoded strings.

## Open items

1. **Real supplier booking** — ✅ architecture complete (Sprint 1 Waves 1–3). Provider
   registry, quote→book→cancel lifecycle, idempotency, event log, and supplier-ref
   tables are all wired. Activate by setting `DUFFEL_API_TOKEN` (flights) and
   `HOTELBEDS_API_KEY`/`HOTELBEDS_SECRET` + `ATLAS_ENV=production` (hotels).
2. **Translate deeper pages** — bookings, clients, finance, support, platform
   (i18n plumbing ready).
3. **Cross-device locale** — sync `user.locale` → cookie on login.
4. **WhatsApp integration** — Meta Cloud API adapter (skeleton ready; Meta
   Business account needed).
5. **Automated quotations** — trigger quote generation from opportunity stage
   change.
6. **Agent performance scoring** — leaderboard from commission + booking counts.
7. **Convert proposal to booking guard** — add `convertedBookingId` column (needs
   migration).

### Known issues (non-blocking)

- **Topbar hydration warning (dev-only).** A React 19 + Radix `useId` mismatch logs
  on the topbar menus (`AppShell` → `Topbar` dropdowns) in the dev console. **Benign:**
  React recovers automatically, every menu/theme/nav works, and it does not surface in
  the production build. Root-caused as far as reasonable: the mobile `Sheet` (the only
  `useId` consumer before the topbar) was proven *not* responsible — the mismatch is
  byte-identical even with the Sheet absent during hydration — and the root providers
  already set `suppressHydrationWarning`. It appears to be a React streaming/Suspense ×
  Radix `useId` interaction; most likely resolved by a future Radix/Next minor bump.
  **Do not** re-chase via app-code edits to the shell (already attempted; no fix, and it
  risks the verified-working chrome). Related: `docs/decisions/0005-app-ui-redesign.md`.

## Planned modules

The longer-horizon module backlog, grouped. Some already have partial foundations
(noted) — the rest are net-new.

**Accounting**
- Accounting · General Ledger · Payroll — net-new finance suite.
- Invoices — ⚠️ on-demand invoice PDFs exist today; this is the move to managed,
  numbered, ledgered invoices.

**Marketing**
- Marketing · Email campaigns — net-new (transactional email via Resend exists;
  campaigns do not).
- WhatsApp — ⚠️ adapter skeleton ready (open item #4); needs a Meta Business account.
- SMS — net-new channel adapter.

**Documents**
- Document management — net-new (today: PDF generation + Vercel Blob uploads for
  supplier contracts).

**Travel products**
- eVisa · Visa tracking — ⚠️ an AI visa assistant exists; these add structured
  application + tracking.
- Insurance — ⚠️ exists as a trip-service item type; this is a managed insurance
  product/flow.
- Vehicle rental · Cruises — net-new verticals (alongside flights/hotels).
- Package builder — net-new (bundle multi-service trips).

**Ecosystem**
- Supplier portal — net-new (suppliers self-serve, parallel to the client portal).
- Customer loyalty · Affiliate program — net-new growth modules.
- API marketplace — net-new (expose/consume third-party integrations).

> These are directional, not scheduled. Phase status and the active gap list are
> above; this is the "what's next after the core is hardened" backlog.

## Spec vs. reality gap tracker

The design system (principles, never-rules, page/table/entity standards, AI
guardrails, automation triggers, perf budgets) describes a **target state**. This
table consolidates every item where the spec is ahead of the code, so the gaps are
one punch list instead of scattered "current state" notes.

Status: ✅ done · 🟡 partial · 🔴 not started

| Item | Spec | Status | Notes |
|---|---|---|---|
| Agent visibility scoped to own records on list pages | [security](security.md) | ✅ | Fixed — clients/bookings/opportunities/products now scope by owner column (commit `134ceb3`). |
| Quality gate `npm run check` works (pnpm v11) | [development-guide](development-guide.md) | ✅ | Fixed — config moved to `pnpm-workspace.yaml`; 0 lint/type errors (commit `7d5f4e1`). |
| Soft delete (`deletedAt`, filtered reads) | [database](database.md#entity-standard) | 🔴 | No soft-delete column anywhere; "never hard delete" is currently aspirational. Needs migration. |
| `reference` on all entities | [database](database.md#entity-standard) | 🟡 | Only `booking` + `product`; missing on clients/opportunities/suppliers. Needs migration. |
| Consistent `updatedAt`/`status`/`notes` on children | [database](database.md#entity-standard) | 🟡 | Present on roots, inconsistent on child tables. |
| Page systemic-five: per-page **Export** | [ui-ux](ui-ux.md#page-requirements-checklist) | 🔴 | Endpoint exists (`/api/export`); list pages lack buttons. |
| Page systemic-five: **Bulk actions** | [ui-ux](ui-ux.md#page-requirements-checklist) | 🔴 | No `Checkbox` primitive exists; nothing built. |
| Page systemic-five: **Loading** states | [ui-ux](ui-ux.md#page-requirements-checklist) | 🔴 | Only `assistant`/`dashboard` have `loading.tsx`. `skeleton.tsx` exists, unused. |
| Page systemic-five: **Error** states | [ui-ux](ui-ux.md#page-requirements-checklist) | 🔴 | Only `assistant` has `error.tsx`. |
| Page systemic-five: **Pagination** | [ui-ux](ui-ux.md#page-requirements-checklist) | 🔴 | Hardcoded `limit` (200/500) silently truncates. |
| Shared **DataTable** (sort, filter, column chooser, infinite scroll, sticky header, shortcuts, context menu) | [ui-ux](ui-ux.md#data-table-standard) | 🔴 | Tables are plain shadcn markup. Building this clears most of the systemic-five. |
| Mobile-friendly tables (`overflow-x-auto`) | [ui-ux](ui-ux.md#atlas-design-principles) | 🔴 | Tables overflow on phones; only `assistant` wraps for scroll. |
| Automation triggers (welcome email, won→proposal, accepted→booking, confirmed→invoice, completed→review) | [business-rules](business-rules.md#automation-triggers) | 🟡 | Only commission auto-gen on confirm/ticket fires; rest manual/on-demand. |
| AI mutation behind a hard confirm step | [ai](ai.md#ai-must-never) | 🔴 | `createBooking` is intent-gated by prompt only, not an enforced confirm gate. |
| Performance instrumentation vs budgets | [ui-ux](ui-ux.md#performance-budgets) | 🔴 | Budgets defined; nothing measured. |
| Real supplier booking (Duffel orders, Hotelbeds book) | [api-integrations](api-integrations.md) | ✅ | Architecture complete (Sprint 1 + 2). Activate with production credentials (see open item #1). |
| Cross-device locale sync | [architecture](architecture.md#internationalization) | 🔴 | English until re-pick on a fresh device (also open item #3 above). |
| Rate limiting (auth + API) | [security](security.md#security-controls) | 🔴 | No throttling anywhere. |
| GDPR subject export/erasure + consent | [security](security.md#security-controls) | 🔴 | No flow; erasure also blocked by missing soft delete. |
| Disaster recovery runbook + RTO/RPO | [security](security.md#security-controls) | 🔴 | Neon has provider backups; no documented DR plan. |
| Universal audit-log coverage | [security](security.md#security-controls) · [coding-standards](coding-standards.md#engineering-rules) | 🟡 | `logActivity` in ~11/21 action files; not all mutations logged. |
| Universal Zod input validation | [coding-standards](coding-standards.md#engineering-rules) | 🟡 | Zod in ~13/21 action files; not every action validates. |
| `activity_log` partitioning + retention (500M-row target) | [architecture](architecture.md#scale-targets) | 🔴 | Single unpartitioned table; no archival. |
| Search concurrency/backpressure (100 concurrent) | [architecture](architecture.md#scale-targets) | 🔴 | No queue or rate control on hotel/flight search. |

## Changelog

| Commit | Summary |
|---|---|
| `1163ab9` | **Auto-booking on proposal accept** — accepting + signing a proposal auto-creates an `awaiting_payment` booking (idempotent, tenant-safe); `product.convertedBookingId`, migration `0020`. [decision 0006](decisions/0006-auto-booking-on-proposal-accept.md) |
| `b76c911` | **Dashboard** deduped vs manager Insights (removed 6 repeated KPIs/panels) + operational "act-today" band (departures 7d, proposals awaiting, overdue, new clients) + "closing this month" chart |
| `3cec99d` `ea3c760` | **AI assistant → analyst**: tenant-safe read tools across every data domain (bookings, clients, proposals, pipeline, finance, commissions) + a live client/booking context rail |
| `2f08368` | Assistant honors platform-admin **"view as"** agency scoping (empty-CRM bug) |
| `f088abc`…`16e9b17` | **AI provider → Google Gemini** (primary; OpenRouter fallback + runtime chain); multi-turn tool-call fix, DZD (not EUR) internal figures |
| `c7b9acc` | Unified **`StatStrip`** KPI band rolled out app-wide |
| `f3564ec`…`b41c8c2` | **UI redesign complete** — all 55 routes to deck standard (tokens/primitives, ⌘K palette, mobile tab bar, per-screen rebuilds) |
| `5d9ab6d` | UI redesign **deck-fidelity rebuild**: flight search, booking details, customer portal & AI assistant rebuilt to their mockups (audit found phases 2–4 were token-skinned only, fidelity 1–2/5 → now 4–5/5, zero functional regressions) |
| `eadc1b8` | UI redesign: **Reports → analytics dashboard** (deck slide 12) — 6-KPI row, revenue trend, weighted-pipeline forecast card, "period at a glance"; CSV/Excel export preserved |
| `ffa3dd4` | UI redesign: **deck identity adopted app-wide** — Atlas Blue primary, cool-paper canvas, white cards, dark ink sidebar, 14px cards, deck shadows/charts (globals.css + app-shell); Geist kept. See [decision 0006](decisions/0006-deck-identity-adoption.md) |
| `b48c626` | UI redesign **Phase 1**: Dashboard, CRM list + profile, Pipeline (command center) — StatCard deltas, +Tabs/Breadcrumb/Tooltip primitives |
| `84aab5e` | UI redesign **Phase 0**: design foundation — chart palette, brand accent, elevation tokens, StatCard deltas |
| `9b151f3` | UI redesign **Phase 4 (skin)**: AI assistant polish (brand Bot tile, role icons, shadcn Input) — later fully rebuilt in `5d9ab6d` |
| `522c742` | UI redesign **Phase 4**: customer portal (4 pages, parallel workflow) — elevated cards, EmptyStates, balance hero; +DESIGN.md amber status colour |
| `9b3f392` | UI redesign **Phase 4**: reports export hub — elevated cards + per-dataset icon tiles |
| `853e195` | UI redesign **Phase 3**: finance/commissions polish + bookings-list `loading.tsx`/`error.tsx` (workflow) |
| `ebaba97` | UI redesign **Phase 3**: booking-details — breadcrumb, KPI strip, finance hero (map→plan→implement→verify workflow) |
| `7c9b378` | UI redesign **Phase 3**: bookings-list derived KPI strip (counts, no FX summing) |
| `70d52a5` | UI redesign **Phase 2**: hotel search — elevated panel, loading skeleton, EmptyState |
| `b754e77` | UI redesign **Phase 2**: flight search — elevated panel, loading skeleton, EmptyState |
| `8b25e19` | UI redesign **Phase 2**: flight result cards — airline logo tiles + interactive hover |
| `7f21420` | UI redesign **Phase 2**: proposal line items — category tiles, per-line margin, totals panel |
| `403781e` | UI redesign **Phase 2**: proposal-builder shell — breadcrumb + sectioned card |
| `b48c626` | UI redesign **Phase 1**: Dashboard, CRM list + profile, Pipeline rebuilt to mockup standard; +Tabs/Breadcrumb/Tooltip primitives; derive-or-omit policy (no schema changes) |
| `84aab5e` | UI redesign **Phase 0**: design foundation — refined chart palette, brand accent, elevation tokens, StatCard deltas |
| _(docs)_ | UI redesign initiative: decision (ADR 0005) + phased plan (`specs/ui-redesign/`) |
| `e842828` | Marketing: full demo dataset (150 clients), design guide + mockup consistency fixes |
| `3f58668` | Marketing: premium 18-slide sales deck + 11 high-fidelity UI mockups (`marketing/`) |
| `95e0c1b` | fix: run db:migrate on every Vercel deploy (migration 0019 was missing from prod) |
| `00c6885` | Sprint 2 Waves 1–4: Travel Platform facade — ContentCapable, AutocompleteCapable, `src/lib/travel-platform/index.ts`, consumer migration |
| `b7eab1b` | Sprint 1 Wave 3: booking-service — quote→book lifecycle, idempotency, event log, supplier ref |
| `cc65ce1` | Sprint 1 Wave 2: DuffelBookingProvider, HotelbedsBookingProvider, MockBookingProvider, registry wiring |
| `bb571d2` | Sprint 1 Wave 1: booking_supplier_ref/event/document/idempotency schema + config module (migration 0019) |
| `a6def26` | Phase 4: standardized BI data export (CSV + Excel) at `/reports` |
| `148d1fb` | Phase 3: country/nationality reference data + city suggestions |
| `e09289f` | Phase 2: controlled vocabularies (enums) for cleaner reporting |
| `0f6840f` | Phase 1 analytics: revenue/conversion/pipeline insights (DZD) |
| `bf71024` | Enrich demo seed: 100 clients, suppliers, commissions, notifications (DZD) |
| `0b5de21` | Restrict currencies to DZD/EUR/USD, default DZD; add hotel name search |
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

Migrations: 19 (latest `0019`). Prod DB: `ep-misty-thunder-aixz34vy`.
