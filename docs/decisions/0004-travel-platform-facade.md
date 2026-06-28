# Decision 0004 — Travel Platform facade over direct supplier access

**Date:** 2026-06-29
**Status:** accepted
**Deciders:** Engineering

## Context

After Sprint 1 wired the booking lifecycle through the provider registry, the
search / content / autocomplete path still called provider-specific functions
directly from server actions and page components:

- `getFlightSupplier()`, `getHotelSupplier()`, `safeSearch()` hardcoded in
  `src/lib/actions/search.ts` (444 lines of Hotelbeds-specific orchestration)
- `isDuffelConfigured()`, `isHotelbedsConfigured()` scattered across 5 page files
- `searchDuffelPlaces`, `getHotelbedsContentBatch`, `searchHotelbedsHotelsByName`,
  etc. imported directly into the action layer

Adding a second search provider (RateHawk, Expedia, Booking.com) would require
editing every consumer file. There was also no single home for the "availability
search → content fallback → thumbnail enrichment" orchestration logic.

## Decision

Introduce `src/lib/travel-platform/index.ts` as the single facade for all travel
operations. Server actions and pages import from this module only; no
provider-specific code leaks into the action or page layer.

## Reasoning

- Keeps the registry pattern consistent: booking was already fully abstracted;
  search should be too.
- One module to update when a new provider is added. Zero consumer changes.
- The hotel search orchestration (availability → content fallback → enrichment)
  was duplicated and implicit in `search.ts`; moving it to the facade makes it
  explicit, testable, and shared.
- Preserves the exact same return shapes (`source`, `degraded`, `estimatedPricing`)
  so all UI components required zero changes.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Move Hotelbeds orchestration into `HotelbedsBookingProvider.searchHotels()` | Cleaner long-term but larger surface area; the availability→content→enrichment flow spans three Hotelbeds APIs with separate quota budgets — better owned by the facade, which can route each step to the best provider |
| Keep `safeSearch` and just add guards | Provider-specific code stays in the action layer; adding provider #3 still requires editing `search.ts` |
| Full rewrite of legacy `suppliers/index.ts` | Sprint constraint: preserve working code, only add the abstraction layer |

## Consequences

**Easier:**
- Adding a new provider (Expedia, RateHawk, Booking.com) requires only: implement
  the relevant capability interfaces, call `providerRegistry.register()` — zero
  consumer changes.
- Hotel search orchestration (content fallback, enrichment) is in one place and
  can be unit-tested.
- `isFlightProviderConfigured()` / `getActiveFlightProvider().label` replace
  provider-specific checks in pages.

**Harder / trade-offs:**
- The content fallback path still calls `listHotelOffersCached` (DB cache) and
  falls back to `ContentCapable.searchHotelsByName` with city-as-query, which is
  an approximation. A future `ContentCapable.searchHotelsByDestination` would be
  more precise.
- The legacy `src/lib/suppliers/index.ts` layer (`getFlightSupplier` / `safeSearch`)
  remains in the codebase for backward compatibility — two layers until it is
  removed in a future cleanup sprint.

## Related

- `src/lib/travel-platform/index.ts` — the facade
- `src/lib/suppliers/providers/` — registry, types, adapters (Duffel, Hotelbeds, Mock)
- `docs/api-integrations.md` — updated with Travel Platform section
- `docs/decisions/0003-booking-architecture-sprint1.md` — Sprint 1 booking registry
