/**
 * Production provider abstraction — barrel.
 *
 * Interfaces + registry only. No provider implementations live here; adapters
 * (Hotelbeds, Amadeus, TravelgateX, Booking.com, Expedia, …) will be added under
 * `./adapters/` and registered via `providerRegistry.register()`. See
 * `docs/api-integrations.md` → "Provider architecture".
 */

export * from "./types";
export * from "./registry";
