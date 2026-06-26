# Feature overview

← Back to [Atlas index](../../atlas.md)

- **Multi-tenancy** — every record scoped to an `agencyId`; agencies fully isolated; per-agency reference numbering.
- **5-role RBAC** — admin, manager, finance, support, agent, each with a tailored landing & nav.
- **Invitation-only onboarding** — signup gated at the auth layer; `/invite/[token]` accept flow; team-page invites.
- **Vendor platform console** (`/platform`) — create / suspend / reactivate agencies, provision first admin.
- **Impersonation** — *View as agency* (act as agency admin) and *View as user* (act as a specific user with their role + scoped data), with an exit banner.
- **Per-role workspaces** — `/finance` (payments/AR + revenue), `/support` (action queue + clients + ops), agency dashboard with analytics charts.
- **Analytics** — bookings by country, team performance, status breakdown, monthly trend, finance KPIs, revenue/collection charts.
- **Bookings lifecycle** — travellers (passports + alerts), items (flights/hotels/etc.), payments (deposits/installments), itineraries, vouchers/invoices, shareable itinerary links.
- **CRM & pipeline** — clients (+contacts), opportunities across stages, products/proposals with line items.
- **Proposals & e-signature** — server-rendered PDF proposals; public, tokenized `/p/[token]` link where a client reviews and **e-signs** (signature + IP/UA audit) → flips the product to accepted and the opportunity to won.
- **Email delivery (Resend)** — real invite emails, password-reset/verification, proposal acceptance; logs to console + `notification` table when unconfigured.
- **SaaS billing (Stripe)** — vendor bills agencies via subscriptions; 14-day trial on provision; webhook reconciles status; `requireAgencyUser` gates on a lapsed subscription.
- **Live travel sourcing** — Duffel flights (airport autocomplete, one-way/round-trip, flight codes, layover airports) and Hotelbeds hotels (destination autocomplete, Booking-style cards with photos, room type, hotel type, board, facilities, room photos, filters); falls back to sample data without keys.
- **Hotel module** (`/hotels`) — Booking.com-style flow: search bar with dynamic occupancy (rooms/adults/children + per-child ages), filter sidebar (price/stars/type/meal/distance/cancellation/supplier), sort + pagination + compare; details page with gallery, facilities, OpenStreetMap, **occupancy-driven dynamic room pricing**, reviews, and add-to-proposal/booking. Real Hotelbeds photos served via a DB content cache (see below).
- **Hotel content cache** — Hotelbeds splits photos (Content API) from prices (availability API), each with its own quota. Content is cached in `hotel_content` and served quota-free; reads are cache-first with live self-heal, bulk-filled by `scripts/sync-hotel-content.ts`. Real hotel/room photos show even when the availability quota is exhausted (rates then shown as estimated).
- **AI assistant** — agency-scoped tools (find clients, bookings summary, create booking).
- **i18n** — English / French / Arabic with full RTL + Arabic font.
- **Settings** — language, theme (light/dark/system), profile.
- **Currencies** — EUR, USD, GBP, DZD, MAD, AED, CHF.
