# Atlas Travel Desk — Full-Scale Demo Dataset

> **The Operating System for Modern Travel Agencies**
> Canonical, internally-consistent demo data powering every marketing mockup, screenshot and presentation.

This document describes `marketing/demo-data.json` — a single, valid JSON file that
scales the canonical 14-client demo (`marketing/assets/demo-data.js`) up to a full
agency's worth of operating data, while keeping the **featured subset byte-for-byte
identical** so the screens still match the mockups exactly.

- **Demo agency:** Atlas Travel Demo — Algiers, Algeria (plan: Scale, 18 seats, since 2019)
- **As of:** 2026-06-29 (this is "today" for all relative dates)
- **Base currency:** DZD (Algerian Dinar). EUR/USD shown where relevant.
  FX: 1 EUR = 145 DZD, 1 USD = 134 DZD.
- **Determinism:** the dataset is generated with a seeded PRNG, so regenerating
  produces the identical file. Money is stored as plain integers (whole DZD).

---

## Headline counts

| Collection | Count | Notes |
|---|---:|---|
| `clients` | **150** | First 14 are the canonical featured clients |
| `opportunities` (active) | **75** | Stages: lead / qualified / proposal / negotiation |
| `bookings` (active) | **45** | First 10 canonical; statuses draft → completed |
| `proposals` (pending) | **30** | Statuses: draft / sent / viewed (first 6 canonical) |
| `employees` | **12** | First 6 canonical (Yasmine, Karim, Lina, Omar, Nadia, Sofiane) |
| `suppliers` | **40** | First 10 canonical (airlines, bedbanks, DMCs, insurance) |
| `completedTrips` | **250** | 12 months of historical bookings (status: completed) |
| `revenueSeries` / `bookingsSeries` | **12** months each | Jul 2025 → Jun 2026 |
| `payments` | 296 | Deposits + balances, reconciled to bookings |
| `invoices` | 195 | One per booking; `paid + outstanding = total` |
| `documents` | 203 | E-tickets, vouchers, passports, visas, insurance |
| `emails` | 112 | Threaded client comms keyed by booking reference |
| `activity` | 68 | Recent feed (first 8 canonical) |
| `notifications` | 15 | First 5 canonical |
| `tasks` | 18 | Follow-ups (first 6 canonical) |
| `destinations` | 8 | Hero top-8 by revenue (verbatim canonical) |
| `closedOpportunities` | 20 | won/lost — funnel realism, **not** counted in the 75 |
| `closedProposals` | 16 | accepted/expired — history, **not** counted in the 30 |

**Top-level collections:** 27.

---

## The canonical featured subset (must match the mockups)

These entities appear first in their arrays with **identical ids, names and money**
as `marketing/assets/demo-data.js`. The generator copies them verbatim, then appends
generated records. Verified by an automated parity check (0 mismatches).

- **6 agents:** Yasmine Haddad (Manager), Karim Benali, Lina Cherif, Omar Said (Agents),
  Nadia Toure (Finance), Sofiane Mansouri (Support).
- **14 clients:** `cli-001` … `cli-014` (Amine Belkacem, Sonatrach Corporate Travel,
  Yacine Brahimi, Fatima Zohra Saidi, GreenField Pharma, Leïla Mansour, Mehdi Cherkaoui,
  Ines Hamidi, Khaled Bouazza, Atlas Engineering Group, Salma Rahmani, Tarek Djebbar,
  Nour El Houda Benamar, Riad Benchaa).
- **10 bookings:** `BKG-2026-001` … `BKG-2026-010`.
- **10 opportunities:** `opp-001` … `opp-010`.
- **6 proposals:** `PRD-2041` … `PRD-2046`.
- **10 suppliers:** `sup-airalgerie`, `sup-emirates`, `sup-turkish`, `sup-qatar`,
  `sup-hotelbeds`, `sup-jaz`, `sup-rixos`, `sup-dmc-haramain`, `sup-dmc-bosphorus`, `sup-allianz`.
- **Hero KPIs, revenue/bookings time series, top-8 destinations:** verbatim canonical
  (the dashboard pins to these exact numbers).

The remaining records (clients 15–150, bookings 11–45, etc.) are generated with
authentic Maghreb names, real destinations/hotels/airlines, and coherent money.

---

## JSON schema (per collection)

### `meta`
`{ generatedFor, asOf, currencyDefault, fx:{DZD_per_EUR,DZD_per_USD}, version, scale, note }`

### `agency`
`{ name, plan, since, seats, timezone, baseCurrency, website, hq }`

### `kpis` (hero numbers — verbatim canonical)
Each key is `{ value, currency?|unit?, delta, trend, label }`. Keys:
`monthlyRevenue, bookings, pipelineValue, conversion, avgMargin, avgBookingValue,
proposalWinRate, outstanding`. `delta` is percentage-points vs. last month.

### `employees` (alias: `agents`)
`{ id, name, role, initials, email, monthlySales, deals, target, color }`
Roles: Manager / Agent / Finance / Support. Finance & Support have `monthlySales: 0`.

### `clients`
```
{ id, name, type:'individual'|'corporate', company,
  email, phone, city, country, status:'vip'|'active'|'lead'|'inactive',
  tags:[…], lifetimeValue, trips, lastActivity,
  passport:{ number, nationality, expiry }, // '—' for corporate
  preferences:{ seat, hotelTier, dietary }, owner: <employee id> }
```
Distribution: ~15 vip, ~98 active, ~23 lead, ~14 inactive. Leads have `trips:0`,
`lifetimeValue:0`.

### `opportunities` (75 active) + `closedOpportunities` (20)
```
{ id, title, clientId, client, value, stage, ownerId, destination,
  closeDate, probability }
```
Active stages: `lead | qualified | proposal | negotiation`. `probability` rises with
stage. Closed have stage `won|lost` (probability 100/0), past `closeDate`.

### `bookings` (45 active) + `completedTrips` (250 historical)
```
{ reference:'BKG-YYYY-NNN', clientId, client, ownerId, destination,
  startDate, endDate, status, total, paid, outstanding, currency, margin, pax,
  travellers:[…],
  flights:[{ airline, route, dep, arr, pnr, cabin }],
  hotel:{ name, stars, nights, city },
  supplierId, supplierRefs:{ flight, hotel } }
```
- Statuses: `draft | awaiting_payment | confirmed | ticketed | completed`.
- **Invariant `paid + outstanding = total`** holds for every record (checked: 0 errors).
- `completedTrips` use `BKG-2025-NNNN` references and spread across the 12-month window;
  active `bookings` are mostly future-dated (`BKG-2026-NNN`).

### `proposals` (30 pending) + `closedProposals` (16)
```
{ id:'PRD-NNNN', clientId, client, destination, value, status, validUntil,
  items:[…], ownerId? }
```
Pending statuses: `draft | sent | viewed`. Closed: `accepted | expired`.

### `suppliers` (40)
`{ id, name, type:'airline'|'bedbank'|'dmc'|'insurance'|'visa', contract, commission, rating, channel }`
Channels: Duffel (flights), Hotelbeds (hotels), Direct (DMC/insurance/visa).

### `payments` (296)
`{ id, bookingRef, clientId, amount, currency, method, type:'deposit'|'balance', date, status }`
Sum of a booking's reconciled payments equals its `paid`.

### `invoices` (195)
`{ id:'INV-YYYY-NNNN', bookingRef, clientId, client, issueDate, dueDate, currency,
  subtotal, total, paid, outstanding, status:'paid'|'partial'|'unpaid' }`

### `documents` (203)
`{ id, name, type, bookingRef, clientId, sizeKb, uploadedBy, uploadedAt }`
Types: e-ticket, hotel-voucher, invoice, passport-scan, visa, travel-insurance, itinerary.

### `emails` (112)
`{ id, threadRef, clientId, from, to, direction:'inbound'|'outbound', subject, preview,
  sentAt, read, hasAttachment }`

### `activity` (68), `notifications` (15), `tasks` (18)
- activity: `{ id, type, agentId, text, time }`
- notifications: `{ id, kind:'info'|'warning'|'success', text, time, read }`
- tasks: `{ id, title, clientId, ownerId, due, priority:'high'|'medium'|'low', done }`

### `destinations` (8, hero) + `destinationsAll`
`{ name, bookings, revenue, share, country }`. `destinations` is the verbatim hero
top-8; `destinationsAll` is the full aggregate computed from `completedTrips`.

### `revenueSeries` / `bookingsSeries` (12 each)
`[{ month:'YYYY-MM', revenue|bookings }]` — Jul 2025 → Jun 2026.

### `leaderboard`
Sellers ranked by `monthlySales` with `attainment` (% of target).

### `upcomingDepartures`
`{ reference, client, destination, date, status }` — soonest first.

---

## How each collection maps to the screens

| Mockup (`marketing/mockups/`) | Primary collections |
|---|---|
| `dashboard.html` | `kpis`, `revenueSeries`, `bookingsSeries`, `destinations`, `activity`, `upcomingDepartures`, `notifications`, `leaderboard` |
| `crm.html` | `clients`, `tasks`, `activity`, `emails`, `documents` |
| `opportunities.html` | `opportunities` (Kanban by `stage`), `closedOpportunities`, `employees` (owners) |
| `proposal-builder.html` | `proposals`, `suppliers`, `destinations`, `clients` |
| `flight-search.html` | `suppliers` (airlines), `bookings.flights`, `destinations` |
| `hotel-search.html` | `suppliers` (bedbanks/DMCs), `bookings.hotel`, hotel catalog |
| `booking-details.html` | `bookings`, `payments`, `invoices`, `documents`, `emails`, `travellers`, `flights`, `hotel` |
| `reports.html` | `revenueSeries`, `bookingsSeries`, `destinationsAll`, `leaderboard`, `kpis`, `completedTrips` |
| `customer-portal.html` | a single client's `bookings`, `proposals`, `documents`, `payments` |
| `ai-assistant.html` | narrates across `clients`, `bookings`, `opportunities`, `tasks` |
| `mobile.html` | condensed `kpis`, `activity`, `notifications`, `upcomingDepartures`, `tasks` |

---

## Consistency guarantees (automatically verified)

- **Canonical parity:** first 14 clients / 10 bookings / 6 agents / 10 opportunities /
  6 proposals / 10 suppliers are byte-identical to `assets/demo-data.js`.
- **Money balances:** `paid + outstanding = total` on every booking, completed trip and
  invoice. Verified — 0 violations.
- **Referential integrity:** every `clientId` and `ownerId` resolves to a real record.
  Verified — 0 broken references.
- **Status coherence:** ticketed/completed are fully paid; drafts unpaid; leads have no
  trips/value; closed opps & proposals are dated in the past.

---

## Regenerating

The dataset is produced deterministically. To rebuild it, re-run the seeded generator
(seed `20260629`) that reads the canonical `assets/demo-data.js` and writes
`marketing/demo-data.json`. Because the PRNG is seeded, output is byte-stable across runs.
