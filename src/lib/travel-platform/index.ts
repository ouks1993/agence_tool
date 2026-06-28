/**
 * Travel Platform — single facade for all travel search and booking.
 *
 * Replaces the hardcoded `getFlightSupplier()` / `getHotelSupplier()` /
 * `safeSearch()` chain in `src/lib/actions/search.ts` with provider-registry
 * routing. Business logic calls this module only; which providers power each
 * vertical is purely a registry concern.
 *
 * Booking operations delegate to booking-service.ts which was already
 * registry-driven from Sprint 1. Search operations are migrated here so the
 * same abstraction covers the full flight + hotel path.
 *
 * Importing this module triggers `@/lib/suppliers/providers` which auto-registers
 * Mock, Duffel, and Hotelbeds into `providerRegistry` as a side effect.
 */

import {
  canAutocomplete,
  canProvideContent,
  canSearchFlights,
  canSearchHotels,
  providerRegistry,
} from "@/lib/suppliers/providers";
import type { ProviderContext } from "@/lib/suppliers/providers";
import {
  listHotelOffersCached,
} from "@/lib/suppliers/content-cache";
import type {
  AirportSuggestion,
  FlightOffer,
  FlightSearchParams,
  HotelOffer,
  HotelSearchParams,
} from "@/lib/suppliers/types";
import type { PlaceSuggestion } from "@/lib/suppliers/providers/types";

export type { ProviderContext, PlaceSuggestion, AirportSuggestion };
export type { FlightOffer, HotelOffer, FlightSearchParams, HotelSearchParams };

// ── Search result shapes (mirror legacy SafeSearchResult for zero UI churn) ──

export type TravelSearchResult<T> = {
  results: T[];
  source: string;
  degraded: boolean;
};

export type HotelTravelSearchResult = TravelSearchResult<HotelOffer> & {
  estimatedPricing?: boolean;
};

// ── Provider info ─────────────────────────────────────────────────────────────

export function getActiveFlightProvider(): { label: string; configured: boolean } {
  const p = providerRegistry.pick("flights", "search");
  return p ? { label: p.label, configured: p.isConfigured() } : { label: "Mock", configured: false };
}

export function getActiveHotelProvider(): { label: string; configured: boolean } {
  const p = providerRegistry.pick("hotels", "search");
  return p ? { label: p.label, configured: p.isConfigured() } : { label: "Mock", configured: false };
}

export function isFlightProviderConfigured(): boolean {
  return getActiveFlightProvider().configured;
}

export function isHotelProviderConfigured(): boolean {
  return getActiveHotelProvider().configured;
}

// ── Static fallback data (no provider needed) ─────────────────────────────────

export const AIRPORTS_FALLBACK: AirportSuggestion[] = [
  { iata: "CDG", name: "Charles de Gaulle", city: "Paris", country: "FR" },
  { iata: "ORY", name: "Orly", city: "Paris", country: "FR" },
  { iata: "LHR", name: "Heathrow", city: "London", country: "GB" },
  { iata: "LGW", name: "Gatwick", city: "London", country: "GB" },
  { iata: "JFK", name: "John F. Kennedy", city: "New York", country: "US" },
  { iata: "EWR", name: "Newark Liberty", city: "New York", country: "US" },
  { iata: "LAX", name: "Los Angeles Intl", city: "Los Angeles", country: "US" },
  { iata: "DXB", name: "Dubai Intl", city: "Dubai", country: "AE" },
  { iata: "IST", name: "Istanbul", city: "Istanbul", country: "TR" },
  { iata: "CMN", name: "Mohammed V", city: "Casablanca", country: "MA" },
  { iata: "RAK", name: "Marrakesh Menara", city: "Marrakesh", country: "MA" },
  { iata: "ALG", name: "Houari Boumediene", city: "Algiers", country: "DZ" },
  { iata: "MAD", name: "Adolfo Suárez Barajas", city: "Madrid", country: "ES" },
  { iata: "BCN", name: "Barcelona El Prat", city: "Barcelona", country: "ES" },
  { iata: "FCO", name: "Fiumicino", city: "Rome", country: "IT" },
  { iata: "AMS", name: "Schiphol", city: "Amsterdam", country: "NL" },
  { iata: "FRA", name: "Frankfurt", city: "Frankfurt", country: "DE" },
  { iata: "CAI", name: "Cairo Intl", city: "Cairo", country: "EG" },
  { iata: "DOH", name: "Hamad Intl", city: "Doha", country: "QA" },
  { iata: "JED", name: "King Abdulaziz", city: "Jeddah", country: "SA" },
];

export const HOTEL_DESTINATIONS: AirportSuggestion[] = [
  { iata: "MAD", name: "Madrid", city: "Madrid", country: "ES" },
  { iata: "BCN", name: "Barcelona", city: "Barcelona", country: "ES" },
  { iata: "PMI", name: "Palma de Mallorca", city: "Palma de Mallorca", country: "ES" },
  { iata: "AGP", name: "Málaga / Costa del Sol", city: "Málaga", country: "ES" },
  { iata: "IBZ", name: "Ibiza", city: "Ibiza", country: "ES" },
  { iata: "VLC", name: "Valencia", city: "Valencia", country: "ES" },
  { iata: "SVQ", name: "Seville", city: "Seville", country: "ES" },
  { iata: "PAR", name: "Paris", city: "Paris", country: "FR" },
  { iata: "NCE", name: "Nice", city: "Nice", country: "FR" },
  { iata: "MRS", name: "Marseille", city: "Marseille", country: "FR" },
  { iata: "LON", name: "London", city: "London", country: "GB" },
  { iata: "DUB", name: "Dublin", city: "Dublin", country: "IE" },
  { iata: "AMS", name: "Amsterdam", city: "Amsterdam", country: "NL" },
  { iata: "LIS", name: "Lisbon", city: "Lisbon", country: "PT" },
  { iata: "BER", name: "Berlin", city: "Berlin", country: "DE" },
  { iata: "VIE", name: "Vienna", city: "Vienna", country: "AT" },
  { iata: "ATH", name: "Athens", city: "Athens", country: "GR" },
  { iata: "IST", name: "Istanbul", city: "Istanbul", country: "TR" },
  { iata: "AYT", name: "Antalya", city: "Antalya", country: "TR" },
  { iata: "BJV", name: "Bodrum", city: "Bodrum", country: "TR" },
  { iata: "DLM", name: "Dalaman / Marmaris", city: "Dalaman", country: "TR" },
  { iata: "ADB", name: "Izmir", city: "Izmir", country: "TR" },
  { iata: "CAI", name: "Cairo", city: "Cairo", country: "EG" },
  { iata: "HRG", name: "Hurghada", city: "Hurghada", country: "EG" },
  { iata: "SSH", name: "Sharm El Sheikh", city: "Sharm El Sheikh", country: "EG" },
  { iata: "DXB", name: "Dubai", city: "Dubai", country: "AE" },
  { iata: "AUH", name: "Abu Dhabi", city: "Abu Dhabi", country: "AE" },
  { iata: "DOH", name: "Doha", city: "Doha", country: "QA" },
  { iata: "RUH", name: "Riyadh", city: "Riyadh", country: "SA" },
  { iata: "JED", name: "Jeddah", city: "Jeddah", country: "SA" },
  { iata: "TUN", name: "Tunis", city: "Tunis", country: "TN" },
  { iata: "CMN", name: "Casablanca", city: "Casablanca", country: "MA" },
  { iata: "TNG", name: "Tangier", city: "Tangier", country: "MA" },
  { iata: "OUD", name: "Oujda", city: "Oujda", country: "MA" },
  { iata: "ROM", name: "Rome", city: "Rome", country: "IT" },
  { iata: "MIL", name: "Milan", city: "Milan", country: "IT" },
  { iata: "FCO", name: "Florence", city: "Florence", country: "IT" },
  { iata: "VCE", name: "Venice", city: "Venice", country: "IT" },
  { iata: "NAP", name: "Naples", city: "Naples", country: "IT" },
  { iata: "PRG", name: "Prague", city: "Prague", country: "CZ" },
  { iata: "BUD", name: "Budapest", city: "Budapest", country: "HU" },
  { iata: "WAW", name: "Warsaw", city: "Warsaw", country: "PL" },
  { iata: "CPH", name: "Copenhagen", city: "Copenhagen", country: "DK" },
  { iata: "OSL", name: "Oslo", city: "Oslo", country: "NO" },
  { iata: "STO", name: "Stockholm", city: "Stockholm", country: "SE" },
  { iata: "HEL", name: "Helsinki", city: "Helsinki", country: "FI" },
  { iata: "BCO", name: "Bali", city: "Bali", country: "ID" },
  { iata: "KUL", name: "Kuala Lumpur", city: "Kuala Lumpur", country: "MY" },
  { iata: "HKG", name: "Hong Kong", city: "Hong Kong", country: "HK" },
  { iata: "TYO", name: "Tokyo", city: "Tokyo", country: "JP" },
  { iata: "OSA", name: "Osaka", city: "Osaka", country: "JP" },
  { iata: "SEL", name: "Seoul", city: "Seoul", country: "KR" },
  { iata: "SHA", name: "Shanghai", city: "Shanghai", country: "CN" },
  { iata: "CUN", name: "Cancun", city: "Cancun", country: "MX" },
  { iata: "HAV", name: "Havana", city: "Havana", country: "CU" },
  { iata: "GRU", name: "São Paulo", city: "São Paulo", country: "BR" },
  { iata: "GIG", name: "Rio de Janeiro", city: "Rio de Janeiro", country: "BR" },
  { iata: "JNB", name: "Johannesburg", city: "Johannesburg", country: "ZA" },
  { iata: "CPT", name: "Cape Town", city: "Cape Town", country: "ZA" },
  { iata: "NBO", name: "Nairobi", city: "Nairobi", country: "KE" },
  { iata: "SYD", name: "Sydney", city: "Sydney", country: "AU" },
  { iata: "MEL", name: "Melbourne", city: "Melbourne", country: "AU" },
  { iata: "BKK", name: "Bangkok", city: "Bangkok", country: "TH" },
  { iata: "SIN", name: "Singapore", city: "Singapore", country: "SG" },
  { iata: "NYC", name: "New York", city: "New York", country: "US" },
  { iata: "LAX", name: "Los Angeles", city: "Los Angeles", country: "US" },
  { iata: "MIA", name: "Miami", city: "Miami", country: "US" },
  { iata: "RAK", name: "Marrakesh", city: "Marrakesh", country: "MA" },
  { iata: "AGA", name: "Agadir", city: "Agadir", country: "MA" },
  { iata: "FEZ", name: "Fez", city: "Fez", country: "MA" },
  { iata: "ALG", name: "Algiers", city: "Algiers", country: "DZ" },
  { iata: "DJE", name: "Djerba", city: "Djerba", country: "TN" },
];

// ── Autocomplete ──────────────────────────────────────────────────────────────

/**
 * Maps the new provider-neutral PlaceSuggestion to the legacy AirportSuggestion
 * shape so consumers (action layer, UI) need zero changes.
 */
function toAirportSuggestion(p: PlaceSuggestion): AirportSuggestion {
  return {
    iata: p.iataCode,
    name: p.name,
    city: p.cityName ?? "",
    country: p.countryName ?? "",
  };
}

/**
 * Airport / city autocomplete. Routes through the registry's autocomplete
 * provider (Duffel when configured); falls back to the static list so the
 * field always suggests in dev / when unconfigured.
 */
export async function searchAirports(
  query: string,
  ctx: ProviderContext
): Promise<AirportSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const provider = providerRegistry.pick("flights", "autocomplete");
  if (provider && canAutocomplete(provider) && provider.isConfigured()) {
    try {
      const suggestions = await provider.searchAirports(q, ctx);
      return suggestions.slice(0, 8).map(toAirportSuggestion);
    } catch (error) {
      console.error("Airport suggest failed, using fallback list:", error);
    }
  }

  const needle = q.toLowerCase();
  return AIRPORTS_FALLBACK.filter(
    (a) =>
      a.iata.toLowerCase().includes(needle) ||
      a.city.toLowerCase().includes(needle) ||
      a.name.toLowerCase().includes(needle)
  ).slice(0, 8);
}

/** Hotel destination autocomplete (filters the curated static list; no provider). */
export function searchHotelDestinations(query: string): AirportSuggestion[] {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];
  return HOTEL_DESTINATIONS.filter(
    (d) =>
      d.iata.toLowerCase().includes(q) ||
      d.city.toLowerCase().includes(q) ||
      d.name.toLowerCase().includes(q)
  ).slice(0, 8);
}

// ── Flights ───────────────────────────────────────────────────────────────────

async function mockFlights(
  params: FlightSearchParams,
  ctx: ProviderContext
): Promise<FlightOffer[]> {
  const mock = providerRegistry.byId("mock");
  if (mock && canSearchFlights(mock)) return mock.searchFlights(params, ctx);
  return [];
}

/**
 * Flight search. Routes through the highest-priority configured flights/search
 * provider; degrades to mock on failure.
 */
export async function searchFlights(
  params: FlightSearchParams,
  ctx: ProviderContext
): Promise<TravelSearchResult<FlightOffer>> {
  const provider = providerRegistry.pick("flights", "search");
  if (provider && canSearchFlights(provider) && provider.isConfigured()) {
    try {
      const results = await provider.searchFlights(params, ctx);
      return { results, source: provider.label, degraded: false };
    } catch (error) {
      console.error("Flight search failed, falling back to mock:", error);
    }
  }
  const results = await mockFlights(params, ctx);
  return { results, source: "Mock", degraded: true };
}

// ── Hotels ────────────────────────────────────────────────────────────────────

async function mockHotels(
  params: HotelSearchParams,
  ctx: ProviderContext
): Promise<HotelOffer[]> {
  const mock = providerRegistry.byId("mock");
  if (mock && canSearchHotels(mock)) return mock.searchHotels(params, ctx);
  return [];
}

/**
 * Hotel search. Handles three paths:
 *
 * 1. **Name search** — if `params.hotelName` is set, routes to the
 *    ContentCapable provider's `searchHotelsByName`.
 *
 * 2. **Availability search** — destination-based search through the
 *    HotelSearchCapable provider. On failure falls back to mock.
 *
 * 3. **Content fallback** — when availability returns empty or degrades to
 *    mock, tries the DB content cache (`listHotelOffersCached`) and then the
 *    ContentCapable provider for real hotel names + photos with estimated rates,
 *    so the UI never shows fully synthetic results when Hotelbeds is configured.
 *
 * After all paths, enriches live-availability results with thumbnails via
 * `ContentCapable.fetchHotelContent` (batch call, same provider that did search).
 */
export async function searchHotels(
  params: HotelSearchParams & { hotelName?: string },
  ctx: ProviderContext
): Promise<HotelTravelSearchResult> {
  // ── 1. Name-search path ────────────────────────────────────────────────────
  if (params.hotelName) {
    const contentProvider = providerRegistry.pick("hotels", "content");
    if (contentProvider && canProvideContent(contentProvider) && contentProvider.isConfigured()) {
      try {
        const results = await contentProvider.searchHotelsByName(params.hotelName, ctx);
        const hasEstimated = results.some((r) => r.estimated);
        return {
          results,
          source: `${contentProvider.label} (name search)`,
          degraded: false,
          estimatedPricing: hasEstimated,
        };
      } catch (error) {
        console.error("Hotel name search failed:", error);
        return {
          results: [],
          source: contentProvider.label,
          degraded: false,
        };
      }
    }
  }

  // ── 2. Availability search path ────────────────────────────────────────────
  let results: HotelOffer[] = [];
  let source = "Mock";
  let degraded = true;
  let estimatedPricing = false;

  const searchProvider = providerRegistry.pick("hotels", "search");
  if (searchProvider && canSearchHotels(searchProvider) && searchProvider.isConfigured()) {
    try {
      results = await searchProvider.searchHotels(params, ctx);
      source = searchProvider.label;
      degraded = false;
    } catch (error) {
      console.error("Hotel search failed, falling back to mock:", error);
    }
  }

  // ── 3. Content fallback when availability is empty / degraded ─────────────
  if ((degraded || results.length === 0) && isHotelProviderConfigured()) {
    try {
      // Cache-first: hits the hotel_content table (quota-free).
      let real = await listHotelOffersCached(params);

      // Cache miss: ask the ContentCapable provider for hotels by destination.
      // searchHotelsByName with the city string is an approximation; a future
      // ContentCapable.searchHotelsByDestination(params, ctx) would be exact.
      if (real.length === 0) {
        const contentProvider = providerRegistry.pick("hotels", "content");
        if (contentProvider && canProvideContent(contentProvider) && contentProvider.isConfigured()) {
          real = await contentProvider.searchHotelsByName(params.city ?? "", ctx);
        }
      }

      if (real.length > 0) {
        results = real;
        source = `${searchProvider?.label ?? "Hotelbeds"} (live photos · estimated rates)`;
        degraded = false;
        estimatedPricing = true;
      }
    } catch (error) {
      console.error("Content hotel list failed, keeping sample data:", error);
    }
  }

  // Pure mock fallback when everything else failed or no provider is configured.
  if (degraded || results.length === 0) {
    results = await mockHotels(params, ctx);
    source = "Mock";
    degraded = true;
    estimatedPricing = false;
  }

  // ── Thumbnail enrichment for live-availability results ────────────────────
  // Availability results have pricing but no photos; ContentCapable.fetchHotelContent
  // returns thumbnails + category in a single batch call.
  let top = results.slice(0, 40);
  if (!degraded && !estimatedPricing) {
    const contentProvider = providerRegistry.pick("hotels", "content");
    if (contentProvider && canProvideContent(contentProvider) && contentProvider.isConfigured()) {
      const codes = top.map((o) => o.hotelCode).filter(Boolean) as string[];
      if (codes.length > 0) {
        try {
          const enrichments = await contentProvider.fetchHotelContent(codes, ctx);
          const enrichMap = new Map(enrichments.map((e) => [e.code, e]));
          top = top.map((o) => {
            if (!o.hotelCode) return o;
            const e = enrichMap.get(o.hotelCode);
            if (!e) return o;
            return {
              ...o,
              thumbnail: e.images?.[0]?.url ?? o.thumbnail,
            };
          });
        } catch (error) {
          console.error("Hotel enrichment batch failed:", error);
        }
      }
    }
  }

  return { results: top, source, degraded, estimatedPricing };
}
