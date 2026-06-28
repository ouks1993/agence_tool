/**
 * Built-in provider registration — wires the concrete adapters into the
 * registry. This is the registration module the registry header refers to
 * ("adapters register themselves here at startup").
 *
 * `registerBuiltInProviders()` adds one instance of each shipped provider
 * (Mock, Duffel, Hotelbeds) into the process-wide `providerRegistry`. It is
 * **idempotent** via a module-level guard, so it is safe to call from multiple
 * entry points (and survives HMR re-imports in dev) without registering twice.
 *
 * Importing this module (directly or via the providers barrel) triggers
 * registration as a side effect, so simply importing the barrel guarantees the
 * registry is populated — callers never have to remember to wire it up.
 */

import { DuffelBookingProvider } from "./duffel-provider";
import { HotelbedsBookingProvider } from "./hotelbeds-provider";
import { MockBookingProvider } from "./mock-provider";
import { providerRegistry } from "./registry";

/** Ensures the built-in providers are registered at most once. */
let registered = false;

/**
 * Register one instance of each built-in provider into `providerRegistry`.
 * Idempotent: repeated calls are a no-op after the first.
 */
export function registerBuiltInProviders(): void {
  if (registered) return;
  registered = true;

  providerRegistry.register(new MockBookingProvider());
  providerRegistry.register(new DuffelBookingProvider());
  providerRegistry.register(new HotelbedsBookingProvider());
}

// Populate the registry on import so the barrel is self-wiring.
registerBuiltInProviders();
