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
