import { AmadeusSupplier } from "./amadeus";
import { DuffelSupplier } from "./duffel";
import { HotelbedsSupplier } from "./hotelbeds";
import { MockSupplier } from "./mock";
import type { SupplierProvider } from "./types";

/**
 * Supplier abstraction layer.
 *
 * Sourcing is split per vertical: flights run through Duffel (Amadeus self-service
 * is decommissioned 2026-07-17, kept only as a legacy fallback), hotels through
 * Hotelbeds. Each falls back to the mock provider when its credentials are
 * absent, so the UI/AI always get usable results in development.
 */

export * from "./types";
export { searchDuffelPlaces } from "./duffel";
export {
  getHotelbedsContent,
  getHotelbedsContentBatch,
  getHotelbedsRates,
  searchHotelbedsContentHotels,
  searchHotelbedsHotelsByName,
} from "./hotelbeds";
export { mockHotelRates, mockHotelContent } from "./mock";

/** True when a live Duffel (flights) token is configured. */
export function isDuffelConfigured(): boolean {
  return Boolean(process.env.DUFFEL_API_TOKEN);
}

/** True when legacy Amadeus (flights) credentials are configured. */
export function isAmadeusConfigured(): boolean {
  return Boolean(
    process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET
  );
}

/** True when live Hotelbeds (hotels) credentials are configured. */
export function isHotelbedsConfigured(): boolean {
  return Boolean(process.env.HOTELBEDS_API_KEY && process.env.HOTELBEDS_SECRET);
}

/** True when any live provider is configured (either vertical). */
export function isLiveSupplierConfigured(): boolean {
  return isDuffelConfigured() || isAmadeusConfigured() || isHotelbedsConfigured();
}

let flightCached: SupplierProvider | null = null;
let hotelCached: SupplierProvider | null = null;

/**
 * The flights provider: Duffel when configured, then legacy Amadeus, otherwise
 * the mock.
 */
export function getFlightSupplier(): SupplierProvider {
  if (flightCached) return flightCached;
  flightCached = isDuffelConfigured()
    ? new DuffelSupplier()
    : isAmadeusConfigured()
      ? new AmadeusSupplier()
      : new MockSupplier();
  return flightCached;
}

/** The hotels provider: Hotelbeds when configured, otherwise the mock. */
export function getHotelSupplier(): SupplierProvider {
  if (hotelCached) return hotelCached;
  hotelCached = isHotelbedsConfigured() ? new HotelbedsSupplier() : new MockSupplier();
  return hotelCached;
}

/**
 * Runs a supplier search but never throws — on any live-provider error it falls
 * back to the mock so the UI/AI always get usable results. The provider is
 * chosen by the caller (flights vs hotels) via `getProvider`.
 */
export async function safeSearch<T>(
  getProvider: () => SupplierProvider,
  run: (provider: SupplierProvider) => Promise<T[]>,
  fallback: (provider: SupplierProvider) => Promise<T[]>
): Promise<{ results: T[]; source: string; degraded: boolean }> {
  const provider = getProvider();
  try {
    const results = await run(provider);
    return { results, source: provider.label, degraded: false };
  } catch (error) {
    console.error("Supplier search failed, falling back to mock:", error);
    const mock = new MockSupplier();
    try {
      const results = await fallback(mock);
      return { results, source: mock.label, degraded: true };
    } catch (fallbackError) {
      console.error("Mock fallback also failed:", fallbackError);
      return { results: [], source: mock.label, degraded: true };
    }
  }
}
