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

## Open items

1. **Real supplier booking** — Duffel orders + Hotelbeds book API (currently
   search-only).
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
| Real supplier booking (Duffel orders, Hotelbeds book) | [api-integrations](api-integrations.md) | 🔴 | Search-only today (also open item #1 above). |
| Cross-device locale sync | [architecture](architecture.md#internationalization) | 🔴 | English until re-pick on a fresh device (also open item #3 above). |
| Rate limiting (auth + API) | [security](security.md#security-controls) | 🔴 | No throttling anywhere. |
| GDPR subject export/erasure + consent | [security](security.md#security-controls) | 🔴 | No flow; erasure also blocked by missing soft delete. |
| Disaster recovery runbook + RTO/RPO | [security](security.md#security-controls) | 🔴 | Neon has provider backups; no documented DR plan. |
| Universal audit-log coverage | [security](security.md#security-controls) | 🟡 | `logActivity` in ~11 action files; not all mutations logged. |
| `activity_log` partitioning + retention (500M-row target) | [architecture](architecture.md#scale-targets) | 🔴 | Single unpartitioned table; no archival. |
| Search concurrency/backpressure (100 concurrent) | [architecture](architecture.md#scale-targets) | 🔴 | No queue or rate control on hotel/flight search. |

## Changelog

| Commit | Summary |
|---|---|
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

Migrations: 17 (latest `0017`). Dev DB: `ep-dawn-voice-ai8d6q3o`. Prod DB:
`ep-misty-thunder-aixz34vy`.
