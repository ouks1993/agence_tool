# Roadmap & changelog

← Back to [Atlas index](../../atlas.md)

## Phase status

**Phase 1 — Sellable ✅ COMPLETE**
Email (Resend) · Stripe SaaS billing · Separate Neon DB branches (dev/prod) · PDF proposals · E-signature · Live flights (Duffel) · Live hotels (Hotelbeds + content cache).

**Phase 2 — Competitive ✅ COMPLETE**
Supplier management (`/suppliers`, contracts, rates, picker) · Commissions tracking (auto-generated, two-ledger, `/commissions`) · Client portal (magic-link login, trip view, online payments via Stripe Connect, in-portal proposal signing + portal invite from agent).

**Phase 3 — AI differentiation ✅ COMPLETE**
AI itinerary generation · AI quote builder · AI email drafting · AI visa assistant — all inline, embedded where the work happens.

**UX overhaul ✅ COMPLETE** (20 changes across 4 size categories)
Getting-started checklist · Lifecycle stepper · Board view toggle · Inline search · Portal invite · Convert proposal→booking · Client funnel timeline · Booking hard guards · Vocabulary pass (Trip services, Pipeline, Messages) · Role nav tooltips · Empty-state badges.

---

## Open items

1. **Real supplier booking** — Duffel orders + Hotelbeds book API (currently search-only); persist confirmed offers into `bookingItem.details`.
2. **Translate deeper pages** — bookings, clients, finance, support, platform (i18n plumbing ready; keys need filling).
3. **Cross-device locale** — sync `user.locale` → cookie on login.
4. **WhatsApp integration** — Meta Cloud API adapter (skeleton ready behind `isWhatsAppConfigured()`; Meta Business account needed).
5. **Automated quotations** — trigger quote generation from opportunity stage change.
6. **Agent performance scoring** — leaderboard from commission + booking counts.
7. **Convert proposal to booking guard** — add `convertedBookingId` column to prevent duplicate conversions (needs migration).

---

## Changelog

| Commit | Summary |
|---|---|
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
| `957079b` | Room type, hotel type, facilities, room photos + hotel filters |
| `74e0938` | Booking-style hotel cards with photo thumbnails |
| `b3b6d20` | Hotel destination autocomplete |
| `1a92e27` | Hotel details view with photos (Hotelbeds Content) |
| `78ceb59` | Airport autocomplete (Duffel Places) |
| `b7ffa6d` | Connecting airports for multi-stop flights |
| `508472e` | One-way flight option + flight codes |
| `eb467d0` | Switch flights to Duffel (Amadeus self-service sunsetting) |
| `b67cfa0` | Phase 1: email (Resend), Stripe billing, e-sign, PDF, suppliers |
| `8d679f4` | DZD currency |
| `a233d32` | View-as-user + i18n (EN/FR/AR + RTL) + Settings hub |
| `7fea32e` | Re-runnable demo data seed |
| `63f1d68` | Analytics charts (dashboard + finance) |
| `1896596` | Per-role workspaces (Finance + Support) + role-based landing/nav |
| `f982d2c` | View as agency impersonation |
| `9e8fb4b` | Multi-tenant architecture + vendor platform console |

Migrations: 16 (latest `0016`). Dev DB: `ep-dawn-voice-ai8d6q3o`. Prod DB: `ep-misty-thunder-aixz34vy`.
Run prod migrations: `POSTGRES_URL=<prod-url> npx drizzle-kit migrate`.
