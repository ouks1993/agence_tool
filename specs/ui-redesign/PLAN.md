# UI Redesign — Phased Plan

**Status:** active · **Owner decision:** Option 2 (upgrade the whole app), by phase
**Progress:** Phases 0–4 ✅ · Phase 5 (polish & responsive) next
**Decision record:** [docs/decisions/0005-app-ui-redesign.md](../../docs/decisions/0005-app-ui-redesign.md)

> **Delivery policy (Phases 1–5): redesign, not rewrite.** No schema changes per
> phase. Any mockup field without a backing column is **derived from existing
> data** or **omitted** — never fabricated. Every omission/derivation is recorded
> (see the Phase 1 notes in [docs/roadmap.md](../../docs/roadmap.md)).

Bring the **live application** (`agencetool.vercel.app`) up to the marketing-grade
standard set by the sales deck and mockups under `marketing/`. Each phase is a
visual/UX upgrade of existing screens that **preserves all current functionality,
routes, and server actions** — this is a redesign, not a rewrite.

## Targets & sources of truth

- **Visual target:** `marketing/index.html` + `marketing/mockups/*.html`
- **Design language:** `marketing/DESIGN-RECOMMENDATIONS.md`
- **In-code design system (source of truth, evolves here):** `DESIGN.md` + `globals.css`
- **Data shape for populated screens:** `marketing/demo-data.json`
- **Coding/UX conventions (unchanged):** `AGENTS.md`, `DESIGN.md`

> The mockups are standalone HTML — a **visual target to match**, not code to
> copy. The app is Next.js (App Router) + React + shadcn/ui; rebuild the look with
> real components and real data.

## Guardrails (every phase)

1. **No functional regressions** — routes, server actions, auth, tenancy, i18n
   (EN/FR/AR + RTL), and permissions behave exactly as before.
2. **`DESIGN.md` stays in sync** — when tokens/components change, update `DESIGN.md`
   in the same phase so it remains the source of truth.
3. **Follow the never-rules** — no free text where a dropdown exists, never expose
   another tenant, never sum different currencies, etc. (`AGENTS.md`).
4. **Quality gate before commit** — `lint`, typecheck, and `next build` pass;
   verify the screen in the preview server; deploy to Vercel.
5. **Accessibility & responsive** — keyboard focus, contrast, and mobile layout
   checked per screen, not deferred entirely to Phase 5.

## Phases

### Phase 0 — Design foundation & demo data
The groundwork every later phase depends on.
- Elevate `globals.css` tokens to the marketing palette/scale (spacing, elevation/
  shadows, radii, chart colors, premium accents) and update `DESIGN.md` to match.
- Build the reusable primitives the mockups imply but the app lacks: KPI/stat card
  with delta, KPI grid, chart components (area · donut · horizontal bars · funnel),
  populated empty states, skeleton loaders, refined table, refined sidebar/topbar.
- Seed the **full demo dataset** (`marketing/demo-data.json` shape) into the
  dev/demo agency so every screen looks populated like the mockups.
- **Done when:** tokens + primitives exist, `DESIGN.md` updated, demo agency
  populated, zero regressions on existing pages.

### Phase 1 — Command center (hero screens) ✅
The screens users and prospects see first.
- **Dashboard** → target `mockups/dashboard.html` — ✅ hero KPIs with deltas,
  revenue trend, bookings-by-status, pipeline funnel, upcoming departures,
  derived needs-attention list; manager insights kept + restyled.
- **CRM** — client list + client profile → target `mockups/crm.html` — ✅ premium
  list; profile with breadcrumb, avatar header, derived stat strip, tabbed
  sections, spend-by-year chart, restyled timeline.
- **Pipeline** — Kanban board → target `mockups/opportunities.html` — ✅ breadcrumb,
  5 KPIs, client-side filter bar, rich cards (probability, close date, purpose,
  owner); stage-move + funnel preserved.

Added shared primitives: `src/components/ui/{tabs,breadcrumb,tooltip}.tsx`.

### Phase 2 — Sell & source
The revenue-making workflow.
- **Proposal builder** → target `mockups/proposal-builder.html`
- **Flight search** → target `mockups/flight-search.html`
- **Hotel search** → target `mockups/hotel-search.html`

### Phase 3 — Operate
Fulfilment and money.
- **Bookings** — list + **Booking details** → target `mockups/booking-details.html`
- **Finance / Payments / Commissions** — apply the same card/table/KPI system

### Phase 4 — Client experience & insight
- **Customer portal** → target `mockups/customer-portal.html`
- **Reports & analytics** → target `mockups/reports.html`
- **AI assistant** → target `mockups/ai-assistant.html`

### Phase 5 — Polish & responsive
- Mobile/responsive pass → target `mockups/mobile.html`
- Empty / loading (skeleton) / error states across all pages
- Micro-interactions and transitions per `DESIGN-RECOMMENDATIONS.md`
- Dark-mode parity, accessibility sweep, i18n/RTL verification

## Per-screen acceptance criteria

A screen is "done" when:
- Layout, hierarchy, spacing, and components visibly match the target mockup
  (not pixel-identical, but unmistakably the same product).
- It is populated with realistic demo data (no lorem, no empty hero states).
- It keeps every existing action/route working.
- It is responsive and passes the quality gate.
- `DESIGN.md` reflects any new shared component or token it introduced.

## Sequencing & delivery

Phases run in order; Phase 0 must land first. Each screen within a phase can be
built in parallel once Phase 0 primitives exist. Every phase ends with a
production deploy so the live app visibly improves phase by phase.
