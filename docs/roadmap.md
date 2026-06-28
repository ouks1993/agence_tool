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
