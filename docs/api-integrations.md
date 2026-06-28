# API Integrations

Every external integration **degrades gracefully** to sample or logged behaviour
when its keys are unset, so the app runs end-to-end with only `POSTGRES_URL` +
`BETTER_AUTH_SECRET`. Env vars are summarized in
[development-guide.md](development-guide.md).

## Flights — Duffel

- `src/lib/suppliers/duffel.ts`, behind `getFlightSupplier()` + `safeSearch()`.
- Airport autocomplete, one-way/round-trip, flight codes, connecting airports.
- Falls back to sample data when `DUFFEL_API_TOKEN` is unset.
- Amadeus self-service (`amadeus.ts`) is kept **only as a legacy fallback**.
- **Search-only today** — placing real orders is an open item ([roadmap.md](roadmap.md)).

## Hotels — Hotelbeds (APITUDE)

- `src/lib/suppliers/hotelbeds.ts` + `content-cache.ts`.
- Availability + content APIs. Booking.com-style search/results/details, dynamic
  occupancy pricing, filters, room photos, compare.
- **Content cache** (`hotel_content` table, global/non-tenant) serves real photos,
  facilities and coords quota-free; synced via `scripts/sync-hotel-content.ts`.
- **Search by hotel name** resolves matching hotels via the Content API
  (`searchHotelbedsHotelsByName`) then prices them live; falls back to estimated
  rates.
- Keys: `HOTELBEDS_API_KEY` / `HOTELBEDS_SECRET`. Falls back to sample data when
  unset. **Search-only today** (real booking is an open item).

## Supplier abstraction

`src/lib/suppliers/index.ts` exposes per-vertical `getFlightSupplier` /
`getHotelSupplier` and a `safeSearch` wrapper that catches provider errors and
returns mock results, so the UI never hard-fails. `mock.ts` provides the sample
data; `types.ts` the shared shapes. This is separate from the managed
**supplier directory** (the `supplier` table — agency's own hotel/airline/DMC
contacts; see [business-rules.md](business-rules.md)).

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

## AI — Vercel AI SDK + OpenRouter

- Powers the assistant and inline AI features; see [ai.md](ai.md).
- Key: `OPENROUTER_API_KEY`. AI features no-op/degrade when unset.

## Storage — Vercel Blob (optional)

- Supplier contract PDF uploads. Key: `BLOB_READ_WRITE_TOKEN`.
