# API Integrations

Every external integration **degrades gracefully** to sample or logged behaviour
when its keys are unset, so the app runs end-to-end with only `POSTGRES_URL` +
`BETTER_AUTH_SECRET`. Env vars are summarized in
[development-guide.md](development-guide.md).

## Provider architecture

Booking providers plug into **one abstraction** so adding Hotelbeds, Amadeus,
TravelgateX, Booking.com, or Expedia never touches calling code. Interfaces +
registry live in `src/lib/suppliers/providers/`. Environment resolution lives in
`src/lib/suppliers/config.ts` — the single entry point for credential/hostname
config; no other file reads `process.env` for supplier credentials directly.

- **Capability-segmented interfaces** (`types.ts`) — a provider implements only
  what it offers: `HotelSearchCapable`, `HotelBookingCapable`,
  `FlightSearchCapable`, `FlightBookingCapable`, `CancelCapable`,
  `ContentCapable` (hotel enrichment / name-search), `AutocompleteCapable`
  (airport suggestions). A hotels-only aggregator implements the hotel interfaces
  and nothing else (no empty stubs).
- **Full booking lifecycle** — `search → quote (re-validate price/rate) → book
  (idempotent) → cancel`. Real bedbank/GDS rates expire, so `quoteHotel`/
  `quoteFlight` re-price immediately before `book*`; book requests carry an
  `idempotencyKey` so replays never double-book.
- **Normalized errors** — every provider throws `ProviderError` with a stable
  `code` (`rate_expired`, `sold_out`, `rate_limited`, `provider_unavailable`, …)
  and a `retryable` flag, so callers branch on the code, not provider strings.
- **Tenant-aware context** — every call takes a `ProviderContext`
  (`agencyId`, currency, locale, correlationId, abort signal); providers never
  read globals.
- **Registry** (`registry.ts`) — adapters `register()` themselves at startup;
  callers resolve by vertical + capability + priority
  (`providerRegistry.pick("hotels", "search")`) with capability type-guards
  (`canSearchHotels`, `canBookFlights`, …). Replaces the hardcoded
  `getFlightSupplier()/getHotelSupplier()` if/else.
- **Registration** (`register.ts`, Wave 2) — `registerBuiltInProviders()` wires
  the three shipped adapters into the registry: `MockBookingProvider` (both
  verticals, priority 0, always configured — the fallback),
  `DuffelBookingProvider` (flights, priority 50) and `HotelbedsBookingProvider`
  (hotels, priority 50). It is idempotent (module-level guard) and runs as a
  side effect when the providers barrel is imported, so the registry is
  self-wiring. The mock outranks nothing, so `pick()` returns a real provider
  whenever one is configured and falls back to the mock otherwise.
- **Provider catalog** (`PROVIDER_CATALOG`) — one logic-free source of truth for
  which providers exist, their verticals/capabilities, env vars, and status
  (`live` / `legacy` / `planned`):

| Provider | Verticals | Status |
|---|---|---|
| Mock | flights + hotels | live |
| Duffel | flights | live |
| Amadeus | flights (+ hotels) | legacy |
| Hotelbeds | hotels | live |
| TravelgateX | hotels + flights | planned |
| Booking.com | hotels | planned |
| Expedia (Rapid) | hotels | planned |

**Travel Platform sprint complete (Sprint 2):** search, content, autocomplete,
and booking are all routed through the registry. Business logic no longer calls
provider-specific functions; adding a new provider is a `register()` call only.

- **Booking** (`booking-service.ts`) — full `quote → book → cancel` lifecycle
  via `providerRegistry.pick(...)`, idempotent, writes `booking_supplier_ref` /
  `booking_event` / `booking_idempotency`.
- **Search + content** (`src/lib/travel-platform/index.ts`) — single facade for
  `searchFlights`, `searchHotels` (availability, name-search, content fallback,
  thumbnail enrichment), `searchAirports`, `searchHotelDestinations`. Server
  actions delegate here; the `getFlightSupplier` / `getHotelSupplier` / `safeSearch`
  layer is no longer imported by consumer code (kept for backward compatibility only).
- **New capabilities registered:** `ContentCapable` (Hotelbeds: name-search,
  enrichment, room rates) and `AutocompleteCapable` (Duffel: airport suggestions).

Open item #1 (real supplier booking) is closed — swap in production credentials
and both search and booking flows go live.

## Flights — Duffel

- `src/lib/suppliers/duffel.ts`, behind `getFlightSupplier()` + `safeSearch()`.
- Airport autocomplete, one-way/round-trip, flight codes, connecting airports.
- Falls back to sample data when `DUFFEL_API_TOKEN` is unset.
- Amadeus self-service (`amadeus.ts`) is kept **only as a legacy fallback**.
- **Sprint 1:** `DuffelBookingProvider` implements `FlightSearchCapable` + `FlightBookingCapable` through the registry, adding `quoteFlight` (price revalidation) + `bookFlight` (idempotent order creation) to the existing search capability.

## Hotels — Hotelbeds (APITUDE)

- `src/lib/suppliers/hotelbeds.ts` + `content-cache.ts`.
- Availability + content APIs. Booking.com-style search/results/details, dynamic
  occupancy pricing, filters, room photos, compare.
- **Content cache** (`hotel_content` table, global/non-tenant) serves real photos,
  facilities and coords quota-free; synced via `scripts/sync-hotel-content.ts`.
- **Search by hotel name** resolves matching hotels via the Content API
  (`searchHotelbedsHotelsByName`) then prices them live; falls back to estimated
  rates.
- Keys: `HOTELBEDS_API_KEY` / `HOTELBEDS_SECRET`. Hostname: `HOTELBEDS_HOSTNAME`
  (defaults to test endpoint; set to `https://api.hotelbeds.com` for production).
  Falls back to sample data when keys are unset.
- **Sprint 1:** `HotelbedsBookingProvider` implements `HotelSearchCapable` +
  `HotelBookingCapable` through the registry, adding `quoteHotel` + `bookHotel`.

## Travel Platform facade

`src/lib/travel-platform/index.ts` is the single entry point for all travel
operations. Server actions import from here only; no supplier-specific code
leaks into the action or page layer.

Key exports: `searchFlights`, `searchHotels`, `searchAirports`,
`searchHotelDestinations`, `getActiveFlightProvider`, `getActiveHotelProvider`,
`isFlightProviderConfigured`, `isHotelProviderConfigured`.

The hotel search path handles three cases internally:
1. Name search → `ContentCapable.searchHotelsByName`
2. Availability search → `HotelSearchCapable.searchHotels` + content enrichment via `ContentCapable.fetchHotelContent`
3. Content fallback (empty/degraded availability) → DB cache (`listHotelOffersCached`) → `ContentCapable.searchHotelsByName` with city as query

## Supplier abstraction (legacy)

`src/lib/suppliers/index.ts` — `getFlightSupplier` / `getHotelSupplier` /
`safeSearch` — is kept for backward compatibility. New code must use the
Travel Platform facade instead. This is separate from the managed **supplier
directory** (the `supplier` table — agency's own hotel/airline/DMC contacts;
see [business-rules.md](business-rules.md)).

## Billing — Stripe subscriptions (vendor → agency)

- `src/lib/billing/stripe.ts`. Vendor bills agencies; 14-day trial on provision.
- Checkout, billing portal, and **manual webhook signature verification**.
- `api/stripe/webhook` reconciles subscription status; `requireAgencyUser` gates
  on a lapsed subscription.
- Keys: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`.

## Payments — Stripe Connect (traveler → agency)

- `src/lib/payments/stripe.ts` — **distinct** from billing/stripe.ts.
- Agencies onboard a connected Express account to receive traveler payments
  directly (**destination charges**); the platform takes a configurable fee.
- `api/stripe/connect-webhook` reconciles Connect payments. Powers the client
  portal "Pay now".
- Keys: `STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_PLATFORM_FEE_PERCENT`.

## Email — Resend

- `src/lib/notifications/email.ts` (adapter) + `templates.ts` (HTML).
- Sends invite emails, password-reset, proposal acceptance, portal invites.
- When unconfigured, logs to console + the `notification` table; invite/portal
  links are made copyable so the flow still works.
- Keys: `RESEND_API_KEY`, `EMAIL_FROM`.

## AI — Vercel AI SDK + Google Gemini (primary) / OpenRouter (fallback)

- Powers the assistant and inline AI features; see [ai.md](ai.md).
- Keys: `GEMINI_API_KEY` (primary; `GEMINI_MODEL`, default `gemini-2.5-flash`) and
  `OPENROUTER_API_KEY` (fallback; `OPENROUTER_MODEL`). Both optional — AI features
  no-op/degrade when neither is set.

## Storage — Vercel Blob (optional)

- Supplier contract PDF uploads. Key: `BLOB_READ_WRITE_TOKEN`.
