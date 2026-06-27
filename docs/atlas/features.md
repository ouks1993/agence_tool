# Feature overview

← Back to [Atlas index](../../atlas.md)

## Core platform
- **Multi-tenancy** — every record scoped to an `agencyId`; agencies fully isolated; per-agency reference numbering.
- **5-role RBAC** — admin, manager, finance, support, agent, each with a tailored landing & nav.
- **Invitation-only onboarding** — signup gated at the auth layer; `/invite/[token]` accept flow; team-page invites.
- **Vendor platform console** (`/platform`) — create / suspend / reactivate agencies, provision first admin.
- **Impersonation** — *View as agency* (act as agency admin) and *View as user* (act as a specific user with their role + scoped data), with an exit banner.
- **Per-role workspaces** — `/finance` (payments/AR + revenue + commissions), `/support` (action queue + clients + ops), agency dashboard with analytics charts.
- **Analytics** — bookings by country, team performance, status breakdown, monthly trend, finance KPIs, revenue/collection charts.
- **i18n** — English / French / Arabic with full RTL + Arabic font.
- **Settings** — language, theme (light/dark/system), profile.
- **Currencies** — EUR, USD, GBP, DZD, MAD, AED, CHF.

## CRM & pipeline
- **Clients** — client records with contacts; funnel timeline (activity log + notifications + payments in one chronological view); linked opportunities, proposals, and bookings on the detail page.
- **Opportunities** — pipeline stages, value, currency; link to proposals.
- **Proposals & e-signature** — server-rendered PDF proposals; public tokenized `/p/[token]` link (no login) **and** in-portal signing; e-sign stamps signer name/email/IP/UA; flips opportunity to won. Sharing consolidated into one "Share with client ▾" dropdown. **Convert accepted proposal → booking** with one click.

## Bookings
- **Booking lifecycle** — `draft → awaiting_payment → confirmed → ticketed → completed`; visual stepper on detail page with "Advance to [next]" button; hard prerequisites enforced server-side (confirmed requires items + zero balance; ticketed requires items).
- **Trip services** (formerly "Purchases") — flights, hotels, transfers, excursions, insurance, fees; supplier picker links items to managed suppliers.
- **Travellers** — passports, nationality, expiry alerts.
- **Payments** — deposits, installments, Stripe Connect online payments.
- **Itinerary** — day-by-day timeline; AI-generated or manual; shareable `/i/[token]` link.
- **Vouchers / Invoices** — PDF documents; blocked when booking has no trip services.
- **List/Board toggle** — switch Bookings page between table and kanban (same data as Pipeline page).
- **Inline search** — "Search flights/hotels" button on the trip services panel opens a search sheet pre-scoped to the booking's destination.

## Supplier management
- **Supplier directory** (`/suppliers`) — manage hotels, airlines, car rental, DMC, insurance, etc. with CRUD, type/status filters.
- **Contracts & rates** — commission basis (percent/fixed/net), validity dates, PDF upload via Vercel Blob; structured rate entries per contract.
- **Supplier picker** — combobox on booking items and proposal items replaces free-text supplier field.

## Commissions
- **Two-ledger tracking** — `supplier_to_agency` (agency earns from supplier per booking item) and `agency_to_agent` (agent earns from agency per booking).
- **Auto-generation** — commissions generated automatically when a booking is confirmed or ticketed; idempotent.
- **Ledger** (`/commissions`) — filter by type/status/agent/date; per-currency summary cards; inline per-booking commissions section (finance roles).
- **Finance page KPIs** — pending/earned/paid commission totals alongside payment KPIs.

## Client portal
- **Magic-link login** — passwordless sessions scoped to one client; separate from staff auth.
- **Portal invite** — agents send the magic link from the client or booking detail page; link is copyable when email is unconfigured.
- **Trip view** — client sees their bookings, itinerary items, and payment summary.
- **Online payments** — "Pay now" via Stripe Connect (only when agency is onboarded); success banner on return.
- **Proposal signing** — client can accept/decline proposals from within the portal; full e-sign audit (same as public `/p/[token]` flow).

## Travel sourcing
- **Flights (Duffel)** — airport autocomplete, one-way/round-trip, flight codes, connecting airports; falls back to sample data.
- **Hotels (Hotelbeds)** — Booking.com-style search/results/details, dynamic occupancy pricing, filters, room photos, add-to-proposal/booking; content cache serves real photos quota-free.
- **Hotel module** (`/hotels`) — full search bar with dynamic occupancy (rooms/adults/children + per-child ages), filter sidebar, sort + pagination + compare, details page with gallery/facilities/map.
- **AI assistant** (`/assistant`) — chat with agency-scoped tools: find clients, bookings summary, create booking, search flights/hotels.

## AI inline features
- **AI itinerary generation** — one-click generation from booking items; saves to `booking_day` rows.
- **AI quote builder** — natural-language brief → structured proposal line items pre-filled in the new-proposal form.
- **AI email drafting** — generate subject + body for confirmation, voucher, follow-up, or custom emails from the booking messages panel.
- **AI visa assistant** — per-nationality visa requirement summary from traveller passport nationalities + booking destination.

## Email delivery
- **Resend** — invite emails, password-reset, proposal acceptance, portal invites; logs to console + `notification` table when unconfigured.

## SaaS billing
- **Stripe subscriptions** — vendor bills agencies; 14-day trial on provision; webhook reconciles status; `requireAgencyUser` gates on lapsed subscription.
- **Stripe Connect** — agencies onboard a connected Express account to receive traveler payments directly; platform takes a configurable fee.

## UX
- **Getting-started checklist** — dismissible 4-step card on the dashboard for new agencies; dismissed state persists in DB across devices and team members.
- **Lifecycle stepper** — horizontal progress bar on booking detail with advance button and soft/hard prerequisite guards.
- **Role-gated nav** — locked nav items shown dimmed with tooltip for non-admin roles.
