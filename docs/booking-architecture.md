# Booking Architecture (Sprint 1)

Detailed technical reference for the provider abstraction system, booking
service, idempotency model, and event log introduced in Sprint 1. For a
high-level overview see [api-integrations.md](api-integrations.md).

---

## 1. Overview

The booking architecture introduces a **three-layer** stack on top of the
existing search-only supplier adapters:

```
Server Action (bookings.ts)
       │
       ▼
Booking Service (booking-service.ts)   ← orchestration
       │
       ▼
Provider Registry (registry.ts)        ← routing
       │
       ▼
Concrete Provider (duffel / hotelbeds / mock)
       │
       ▼
Supplier API (Duffel REST / Hotelbeds APITUDE)
```

The server action collects intent (which booking item to fulfil), builds a
`ProviderContext`, and calls `serviceBookFlight` or `serviceBookHotel`. The
booking service runs the full lifecycle — idempotency check, quote, book, event
logging, supplier-ref persistence — without any booking-specific code leaking
into the action layer.

---

## 2. Provider abstraction

### 2.1 Capability-segmented interfaces

`src/lib/suppliers/providers/types.ts`

A provider implements **only the capabilities it actually offers**. There are no
empty stubs. The capability contract:

| Interface | Methods | Who implements |
|---|---|---|
| `ProviderDescriptor` | `id`, `label`, `verticals`, `capabilities`, `priority`, `isConfigured()` | **every** provider |
| `HotelSearchCapable` | `searchHotels(params, ctx)` | Hotelbeds, Mock |
| `HotelBookingCapable` | `quoteHotel(offer, ctx)`, `bookHotel(req, ctx)` | Hotelbeds, Mock |
| `FlightSearchCapable` | `searchFlights(params, ctx)` | Duffel, Mock |
| `FlightBookingCapable` | `quoteFlight(offer, ctx)`, `bookFlight(req, ctx)` | Duffel, Mock |
| `CancelCapable` | `cancel(ref, ctx)` | (future) |

A concrete provider is typed as:

```typescript
type BookingProvider = ProviderDescriptor &
  Partial<HotelSearchCapable & HotelBookingCapable &
          FlightSearchCapable & FlightBookingCapable & CancelCapable>
```

Callers narrow capabilities using type-guard functions:

```typescript
canSearchHotels(p)   // p is HotelSearchCapable
canBookHotels(p)     // p is HotelBookingCapable
canSearchFlights(p)  // p is FlightSearchCapable
canBookFlights(p)    // p is FlightBookingCapable
```

### 2.2 ProviderContext

Passed to every provider call so providers never read globals:

```typescript
type ProviderContext = {
  agencyId:      string;          // tenant scope + per-agency cred lookup
  currency?:     string;          // ISO code, e.g. "DZD"
  locale?:       string;          // e.g. "en"
  correlationId?: string;         // traces a request across providers and logs
  signal?:       AbortSignal;     // timeout / user cancellation
}
```

### 2.3 Booking lifecycle DTOs

**`RateQuote`** — returned by `quoteHotel` / `quoteFlight`:

| Field | Type | Purpose |
|---|---|---|
| `quoteId` | `string` | Opaque token passed to `book*` |
| `providerId` | `ProviderId` | Which provider issued the quote |
| `vertical` | `"flights" \| "hotels"` | — |
| `priceTotal` | `number` | Price after re-validation |
| `currency` | `string` | — |
| `refundable` | `boolean` | — |
| `expiresAt` | `string` (ISO) | Quote expiry deadline |
| `cancellationDeadline?` | `string` (ISO) | Free-cancel deadline (when refundable) |
| `priceChanged?` | `boolean` | True when price differs from search result |

**`HotelBookingRequest`** — sent to `bookHotel`:

| Field | Type | Purpose |
|---|---|---|
| `offer` | `HotelOffer` | Original search offer |
| `guests` | `GuestDetails[]` | Guest roster (lead first) |
| `idempotencyKey` | `string` | Caller-generated; same key = no double-book |
| `quoteId?` | `string` | Fresh rate key from `quoteHotel` |
| `agencyReference?` | `string` | Cross-linking reference (e.g. `BKG-1001`) |

**`FlightBookingRequest`** — sent to `bookFlight`:

| Field | Type | Purpose |
|---|---|---|
| `offer` | `FlightOffer` | Original search offer |
| `passengers` | `FlightPassenger[]` | Passenger roster |
| `idempotencyKey` | `string` | Caller-generated; same key = no double-book |
| `quoteId?` | `string` | Fresh quote token |
| `agencyReference?` | `string` | Cross-linking reference |

**`BookingResult`** — returned by `book*` on success:

| Field | Type |
|---|---|
| `ref.providerId` | `ProviderId` |
| `ref.confirmationNumber` | `string` |
| `ref.raw?` | `unknown` (raw supplier response) |
| `status` | `"confirmed" \| "pending"` |
| `priceTotal` | `number` |
| `currency` | `string` |

### 2.4 Normalized error model

All providers throw `ProviderError` with a stable `code`:

| Code | Meaning | Retryable |
|---|---|---|
| `auth` | Bad/expired credentials | false |
| `validation` | Malformed request | false |
| `rate_expired` | Quote/rate no longer valid → re-quote | true |
| `sold_out` | Availability gone | false |
| `rate_limited` | Provider throttled us → backoff | true |
| `provider_unavailable` | Upstream down/timeout | true |
| `not_supported` | Capability not offered by this provider | false |
| `unknown` | Unclassified | false |

Callers branch on `code`, never on provider-specific error strings:

```typescript
} catch (err) {
  if (err instanceof ProviderError && err.code === "rate_expired") {
    // re-quote then retry
  }
}
```

---

## 3. Provider registry

`src/lib/suppliers/providers/registry.ts`

The registry is a singleton. Providers self-register at startup and callers
resolve by vertical + capability.

### 3.1 API

```typescript
// Register (called by each provider at startup):
providerRegistry.register(provider: BookingProvider): void

// Resolve (returns highest-priority configured provider for vertical+capability):
providerRegistry.pick(vertical: ProviderVertical, capability: ProviderCapability): BookingProvider | undefined

// Introspect:
providerRegistry.list(): BookingProvider[]
providerRegistry.all(vertical, capability): BookingProvider[]
```

`pick()` returns the highest-priority `isConfigured()` provider for the
requested vertical + capability. If no configured provider exists, it returns
`undefined` — the caller must handle that gracefully (the mock always fills
this gap since it is always configured at priority 0).

### 3.2 Registration (register.ts)

`src/lib/suppliers/providers/register.ts` wires all three built-in adapters
into the registry **as a module side effect** — importing the providers barrel
triggers registration automatically:

```typescript
export function registerBuiltInProviders(): void {
  if (registered) return;          // module-level idempotency guard
  registered = true;
  providerRegistry.register(new MockBookingProvider());      // priority 0 — always
  providerRegistry.register(new DuffelBookingProvider());    // priority 50
  providerRegistry.register(new HotelbedsBookingProvider()); // priority 50
}
registerBuiltInProviders();        // runs on import
```

### 3.3 Provider catalog (PROVIDER_CATALOG)

Logic-free metadata record used to drive UI ("Available integrations") and
future dynamic registration. The catalog is not the registry — it is a static
description of what *could* be wired:

| Provider | Verticals | Capabilities | Status | Env vars |
|---|---|---|---|---|
| `mock` | flights + hotels | search, quote, book | live | (none) |
| `duffel` | flights | search, quote, book | live | `DUFFEL_API_TOKEN` |
| `amadeus` | flights (+ hotels) | search | legacy | `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET` |
| `hotelbeds` | hotels | search, quote, book | live | `HOTELBEDS_API_KEY`, `HOTELBEDS_SECRET` |
| `travelgatex` | hotels + flights | search | planned | — |
| `booking_com` | hotels | search | planned | — |
| `expedia` | hotels | search | planned | — |

### 3.4 Priority resolution

When multiple providers are configured for the same vertical:

- **Highest priority wins** (higher number = higher priority).
- `MockBookingProvider` is always priority **0** — the unconditional fallback.
- `DuffelBookingProvider` and `HotelbedsBookingProvider` are priority **50**.
- Add a future aggregator at **100** to override the defaults.

---

## 4. Booking service

`src/lib/suppliers/booking-service.ts`

The orchestration layer. Server actions call `serviceBookFlight` or
`serviceBookHotel` and receive a `ServiceBookingResult`:

```typescript
type ServiceBookingResult =
  | { confirmed: true;  confirmationNumber: string; providerId: string }
  | { confirmed: false; confirmationNumber: string; reason: string }
```

**The booking service never throws.** Failures are returned as
`{ confirmed: false }` so the server action can write a provisional reference
and surface a user-facing error without crashing the booking flow.

### 4.1 Flight booking flow (serviceBookFlight)

```
1. Derive idempotency key
   sha256("bookingId:bookingItemId:offerId")

2. Replay check
   IF booking_idempotency.status = "success" THEN return cached result (no supplier call)

3. Pick provider
   providerRegistry.pick("flights", "book") → DuffelBookingProvider (or mock)
   IF no provider → return { confirmed: false, reason: "No configured flight booking provider" }

4. Register idempotency key as "pending" (ON CONFLICT DO NOTHING)
   → prevents duplicate calls even if two requests race to the same booking

5. Quote (price revalidation) — non-fatal
   provider.quoteFlight(offer, ctx)
   → emit "price_validated" or "price_changed" event

6. Emit "booking_submitted" event

7. Book
   provider.bookFlight({ offer, passengers, idempotencyKey, agencyReference }, ctx)

8. On success:
   - INSERT booking_supplier_ref (confirmationNumber, pnr, rawPayload)
   - UPDATE booking_idempotency → status = "success", supplierRef = confirmationNumber
   - emit "booking_confirmed" event
   - return { confirmed: true, confirmationNumber, providerId }

9. On failure:
   - UPDATE booking_idempotency → status = "failed"
   - emit "booking_failed" event
   - return { confirmed: false, confirmationNumber: "REF-<timestamp>", reason }
```

### 4.2 Hotel booking flow (serviceBookHotel)

Same as 4.1 with two differences:

1. **offerId** is `offer.rateKey ?? offer.id` (Hotelbeds uses rate keys).
2. **Quote carries the fresh `rateKey`** — `quoteHotel` returns a new
   `quoteId` (the refreshed Hotelbeds `rateKey`), which is passed as
   `quoteId` in the `HotelBookingRequest`. This ensures the book call always
   uses the freshest rate, never the one from the initial search.

### 4.3 Quote step — non-fatal by design

If `quoteFlight`/`quoteHotel` throws, the booking service logs a warning and
proceeds to book. This prevents a quote-API timeout from blocking an entire
booking attempt — the supplier's `book*` endpoint will reject a stale rate
explicitly if it expired, surfacing as a `ProviderError("rate_expired")` from
the book step itself.

For hotels, if the quote fails the `quoteId` is `undefined` and the book
request uses the original `rateKey` from the search offer.

---

## 5. Idempotency model

### 5.1 Key derivation

```typescript
sha256(`${bookingId}:${bookingItemId}:${offerId}`)
```

- `offerId` is the supplier's offer/rate identifier (e.g. Duffel offer id,
  Hotelbeds `rateKey`).
- The same triple always produces the same 64-hex-char key.
- Keys are written with `ON CONFLICT DO NOTHING`, so two concurrent requests
  for the same booking item cannot both insert a "pending" row.

### 5.2 Lifecycle states

| State | Meaning |
|---|---|
| `pending` | Row inserted before the supplier call |
| `success` | Supplier confirmed; `supplierRef` is the confirmation number |
| `failed` | Supplier rejected; safe to retry with a fresh key (new offer/rate) |

### 5.3 Replay semantics

- On success (`status = "success"`): return `supplierRef` immediately — no
  supplier call. This handles browser re-submits, network retries, and
  serverless double-invocations.
- On pending (`status = "pending"`): the prior call is still in flight (or
  crashed mid-flight). `ON CONFLICT DO NOTHING` means the new attempt skips
  the insert and proceeds to quote/book. The supplier's own idempotency key
  prevents double-booking at the supplier level.
- On failed (`status = "failed"`): the key represents a bad offer; the agent
  should select a fresh offer (which will have a different `offerId`) and book
  again with a new key.

### 5.4 TTL

Keys expire after **24 hours** (`expiresAt` column). A future cron job can
clean up expired rows. Expired rows do not block new bookings — expiry is
advisory.

---

## 6. Event log (`booking_event`)

Append-only. Never update or delete rows.

### 6.1 Event types

| Event | When | Metadata |
|---|---|---|
| `search_initiated` | Agent starts a search | `{ destination, checkIn, nights, guests }` |
| `offer_selected` | Agent picks an offer from results | `{ offerId, priceTotal, currency }` |
| `price_validated` | Quote returned same price | `{ priceTotal, currency }` |
| `price_changed` | Quote returned different price | `{ priceTotal, currency }` |
| `booking_submitted` | Just before calling `book*` | `{ offerId, priceChanged }` |
| `booking_confirmed` | `book*` returned success | `{ confirmationNumber, status, priceTotal, currency }` |
| `booking_failed` | `book*` threw | `{ reason }` |
| `booking_cancelled` | Cancellation succeeded | `{ penaltyAmount, currency }` |
| `payment_started` | Stripe Checkout session created | `{ sessionId, amount }` |
| `payment_completed` | Stripe webhook confirmed | `{ sessionId, amount }` |

### 6.2 Dual purpose

- **Compliance audit trail** — every state transition is permanently recorded
  with timestamp, providerId, and correlationId. Never deleted (even if the
  booking itself is cancelled).
- **Analytics source** — booking funnel metrics (search→select, select→book,
  book→confirm, confirm→cancel) can be derived directly from this table
  without a third-party SDK.

### 6.3 Schema

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `bookingId` | `uuid` | FK → `booking` |
| `agencyId` | `uuid` | FK → `agency` (for efficient agency-scoped analytics) |
| `event` | `text` | Stable event code (see 6.1) |
| `providerId` | `text?` | `"duffel"`, `"hotelbeds"`, `"mock"`, or null for UI events |
| `correlationId` | `text?` | Traces a request across logs |
| `metadata` | `jsonb?` | Structured payload (offer id, price, error, etc.) |
| `createdAt` | `timestamp` | Append timestamp |

**Indexes:** `bookingId`, `agencyId`, `event`, `createdAt`, composite `(bookingId, createdAt)`.

---

## 7. Supplier reference (`booking_supplier_ref`)

Structured record of the supplier's confirmation for a booking item. Replaces
the ad-hoc JSONB in `booking_item.details` so references are **queryable** for
status polling, cancellation, and voucher retrieval.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `bookingId` | `uuid` | FK → `booking` |
| `bookingItemId` | `uuid` | FK → `booking_item` |
| `providerId` | `text` | `"duffel"`, `"hotelbeds"`, etc. |
| `confirmationNumber` | `text` | Shown to client |
| `pnr` | `text?` | Airline PNR / record locator |
| `supplierOrderId` | `text?` | Provider's internal order id |
| `rawPayload` | `jsonb?` | Full raw response for debugging + future re-parsing |
| `createdAt` | `timestamp` | — |

Multiple refs per `bookingItemId` are possible (e.g. re-booking after a
failure leaves both the failed attempt and the successful one).

---

## 8. Document store (`booking_document`)

Documents generated for a booking: vouchers, e-tickets, invoices, itineraries.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `bookingId` | `uuid` | FK → `booking` |
| `bookingItemId` | `uuid?` | FK → `booking_item` (null = booking-level doc) |
| `type` | `text` | `"voucher" \| "ticket" \| "invoice" \| "itinerary" \| "receipt"` |
| `providerId` | `text?` | Supplier that issued the document |
| `url` | `text?` | Vercel Blob URL or supplier CDN link |
| `rawData` | `jsonb?` | Supplier's payload for re-generation |
| `generatedAt` | `timestamp?` | When the document was issued |
| `createdAt` | `timestamp` | — |

---

## 9. Adding a new provider

1. **Create the provider class** in `src/lib/suppliers/providers/<name>-provider.ts`.
   - Implement `ProviderDescriptor` on every provider.
   - Implement only the capability interfaces the supplier supports.
   - Throw `ProviderError` (never native `Error`) on failure.
   - Return `true` from `isConfigured()` only when all required env vars are set.

2. **Export from the barrel** — add to `src/lib/suppliers/providers/index.ts`:
   ```typescript
   export * from "./<name>-provider";
   ```

3. **Register in `register.ts`**:
   ```typescript
   providerRegistry.register(new MyNewProvider());
   ```

4. **Add to PROVIDER_CATALOG** — one entry in `registry.ts` with `id`, `label`,
   `verticals`, `capabilities`, `envVars`, and `status: "live"`.

5. **Set priority** — choose a number relative to existing providers. If it
   should win over Duffel/Hotelbeds (priority 50), use `> 50`. Use `< 50` if
   it should only fill the gap when the primary provider is unconfigured.

No calling-code changes are needed — the registry and booking service
automatically route to the new provider when it is configured.

---

## 10. Configuration and activation

All provider credentials are resolved in `src/lib/suppliers/config.ts`:

```
ATLAS_ENV=development   → mock only (default when unset)
ATLAS_ENV=sandbox       → provider sandbox endpoints
ATLAS_ENV=production    → live endpoints
```

| Provider | Required env vars | Optional |
|---|---|---|
| Duffel (flights) | `DUFFEL_API_TOKEN` | — |
| Hotelbeds (hotels) | `HOTELBEDS_API_KEY`, `HOTELBEDS_SECRET` | `HOTELBEDS_HOSTNAME` |

When `ATLAS_ENV=production` and the credentials are set, `pick()` returns the
real provider at priority 50. The mock continues to serve as a fallback only
when the real provider's `isConfigured()` returns `false`.
