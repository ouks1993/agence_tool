/**
 * Production provider abstraction — barrel.
 *
 * Exposes the interfaces + registry AND the concrete adapters (Mock, Duffel,
 * Hotelbeds). Importing this barrel pulls in `./register`, whose import side
 * effect populates `providerRegistry` with the built-in providers, so callers
 * that import from here always get a wired-up registry. Additional adapters
 * (Amadeus, TravelgateX, Booking.com, Expedia, …) register the same way. See
 * `docs/api-integrations.md` → "Provider architecture".
 */

export * from "./types";
export * from "./registry";
export * from "./mock-provider";
export * from "./duffel-provider";
export * from "./hotelbeds-provider";
export * from "./register";
