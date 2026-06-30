# Atlas — TODO

Single consolidated worklist. Source trackers: [docs/roadmap.md](docs/roadmap.md)
(phase status + gap tracker) and [specs/ui-redesign/PLAN.md](specs/ui-redesign/PLAN.md)
(active initiative). Update this file after each committed milestone.

> Delivery policy for the redesign track: **redesign, not rewrite** — no schema
> changes, match `marketing/mockups/*.html`, derive missing fields from real data
> or omit (never fabricate). Quality gate (`npm run check` + `npm run build:ci`)
> must pass before every commit.

---

## Active initiative — UI redesign

### Phase 0 — Design foundation ✅
- [x] Tokens (chart palette, brand accent, elevation shadows, radii) + `DESIGN.md`
- [x] Primitives (StatCard+delta, empty-state, skeleton, charts, breadcrumb/tabs/tooltip)
- [x] Full demo dataset seeded

### Phase 1 — Command center ✅
- [x] Dashboard (hero KPIs, trend, status, funnel, departures, needs-attention)
- [x] CRM list + client profile (breadcrumb, avatar header, stat strip, tabs, timeline)
- [x] Pipeline board on `/opportunities` (breadcrumb, 5 KPIs, filter bar, rich cards)

### Phase 2 — Sell & source ⬜ (next)
Target mockups: `proposal-builder.html`, `flight-search.html`, `hotel-search.html`.

**2.1 Proposal builder** (`products/new`, `products/[id]/edit`)
- [x] Page shell — breadcrumb + command-center layout/spacing + elevated cards
- [x] Form sectioning ("Trip details" grouped card)
- [x] Line-items manager restyle (per-category colour tiles + per-line margin)
- [x] Totals/summary panel (total cost · margin % · total sell)
- [~] Live proposal preview pane — **omitted** (derive-or-omit policy: net-new
      renderer, not a redesign; public `/p/[token]` view + PDF already exist)
- [ ] Verify (preview snapshot) — blocked: dev DB has no seeded user

**2.2 Flight search** (`search`, `sourcing/flights`)
- [x] Search workspace shell — elevated search panel (sidebar-filter layout deferred)
- [x] Result cards — airline logo tile + interactive hover + tabular pricing
- [x] Empty (EmptyState) + loading (skeleton cards) + error (toast) states
- [ ] Verify — blocked: dev DB has no seeded user

**2.3 Hotel search** (`hotels`, `hotels/[code]`)
- [x] Search experience shell — elevated panel (occupancy-picker unchanged)
- [x] Result cards — interactive hover (details view `hotels/[code]` deferred)
- [x] Empty (EmptyState) + loading (skeleton cards) + error (toast) states
- [ ] Verify — blocked: dev DB has no seeded user

### Phase 3 — Operate ⬜ (started)
**Bookings** (`bookings`, `bookings/[id]`)
- [x] List — derived KPI strip (total · upcoming · awaiting payment · completed; counts only, no FX summing)
- [ ] List — loading/error states; DataTable polish
- [ ] Booking details → `booking-details.html` (header, lifecycle, items, payments)
**Finance / Payments / Commissions**
- [ ] Apply card/table/KPI system

### Phase 4 — Client experience & insight ⬜
- [ ] Customer portal → `customer-portal.html`
- [ ] Reports & analytics → `reports.html`
- [ ] AI assistant → `ai-assistant.html`

### Phase 5 — Polish & responsive ⬜
- [ ] Mobile/responsive pass → `mobile.html`
- [ ] Empty / loading / error states across all pages
- [ ] Micro-interactions, dark-mode parity, a11y sweep, i18n/RTL verification

---

## Functional open items (roadmap)
Not part of the visual redesign; tracked separately.

- [ ] #1 Activate real supplier booking (set prod creds — architecture done)
- [ ] #2 Translate deeper pages (bookings, clients, finance, support, platform)
- [ ] #3 Cross-device locale sync (`user.locale` → cookie on login)
- [ ] #4 WhatsApp integration (Meta Cloud API adapter)
- [ ] #5 Automated quotations (quote on opportunity stage change)
- [ ] #6 Agent performance scoring (leaderboard)
- [ ] #7 Convert-proposal→booking guard (`convertedBookingId` column — needs migration)

## Gap tracker — 🔴 not started
From [docs/roadmap.md](docs/roadmap.md#spec-vs-reality-gap-tracker).

- [ ] Soft delete (`deletedAt`, filtered reads) — needs migration
- [ ] Shared DataTable (sort/filter/column chooser/infinite scroll/sticky header)
- [ ] Per-page Export buttons · Bulk actions · Loading · Error · Pagination
- [ ] Mobile-friendly tables (overflow-x-auto)
- [ ] AI mutation behind a hard confirm step
- [ ] Performance instrumentation vs budgets
- [ ] Rate limiting (auth + API)
- [ ] GDPR subject export/erasure + consent
- [ ] Disaster recovery runbook + RTO/RPO
- [ ] `activity_log` partitioning + retention; search concurrency/backpressure

## Gap tracker — 🟡 partial
- [ ] `reference` on all entities (only booking + product today)
- [ ] Consistent `updatedAt`/`status`/`notes` on child tables
- [ ] Universal audit-log coverage (`logActivity` ~11/21 action files)
- [ ] Universal Zod input validation (~13/21 action files)
- [ ] Automation triggers (only commission auto-gen fires today)

---

## Housekeeping
- [ ] Confirm whether `specs/ui-polish-responsive/` is stale (references boilerplate
      screens — chat/home/auth/profile) and remove if superseded by `ui-redesign`.
</content>
</invoke>
