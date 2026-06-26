"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import { requireUser } from "@/lib/permissions";
import {
  getHotelbedsRates,
  getFlightSupplier,
  getHotelSupplier,
  getHotelbedsContentBatch,
  isDuffelConfigured,
  isHotelbedsConfigured,
  mockHotelRates,
  safeSearch,
  searchDuffelPlaces,
  searchHotelbedsContentHotels,
  type AirportSuggestion,
  type FlightOffer,
  type HotelDetails,
  type HotelOffer,
  type HotelRoomRate,
} from "@/lib/suppliers";
import {
  getHotelContentCached,
  listHotelOffersCached,
} from "@/lib/suppliers/content-cache";

/** Small built-in airport list so autocomplete works without a live provider. */
const AIRPORTS_FALLBACK: AirportSuggestion[] = [
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

/**
 * Airport / city autocomplete. Uses Duffel's Places API when configured,
 * otherwise filters a small built-in list so the field still suggests in dev.
 */
export async function searchAirportsAction(
  query: string
): Promise<AirportSuggestion[]> {
  await requireUser();
  const q = query.trim();
  if (q.length < 2) return [];

  if (isDuffelConfigured()) {
    try {
      return (await searchDuffelPlaces(q)).slice(0, 8);
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

const flightSchema = z.object({
  origin: z.string().trim().min(3, "Origin code required").max(3),
  destination: z.string().trim().min(3, "Destination code required").max(3),
  departDate: z.string().min(1, "Departure date required"),
  returnDate: z.string().optional(),
  adults: z.coerce.number().int().min(1).max(9).default(1),
  cabin: z.enum(["economy", "premium", "business", "first"]).default("economy"),
  currency: z.string().default("EUR"),
});

const hotelSchema = z.object({
  city: z.string().trim().min(2, "City required"),
  cityCode: z.string().trim().optional(),
  checkIn: z.string().min(1, "Check-in required"),
  checkOut: z.string().min(1, "Check-out required"),
  adults: z.coerce.number().int().min(1).max(9).default(2),
  rooms: z.coerce.number().int().min(1).max(9).default(1),
  /** Ages of each child (0–17). Length is the child count sent to the supplier. */
  childAges: z.array(z.coerce.number().int().min(0).max(17)).max(9).default([]),
  minStars: z.coerce.number().int().min(0).max(5).optional(),
  currency: z.string().default("EUR"),
});

export type FlightSearchResult = {
  ok: boolean;
  error?: string;
  results: FlightOffer[];
  source: string;
  degraded: boolean;
};

export type HotelSearchResult = {
  ok: boolean;
  error?: string;
  results: HotelOffer[];
  source: string;
  degraded: boolean;
  /** True when hotels/photos are live but rates are estimated (no live pricing). */
  estimatedPricing?: boolean;
};

export async function searchFlightsAction(
  input: z.input<typeof flightSchema>
): Promise<FlightSearchResult> {
  await requireUser();
  const parsed = flightSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid search",
      results: [],
      source: getFlightSupplier().label,
      degraded: false,
    };
  }
  const p = parsed.data;
  const { results, source, degraded } = await safeSearch<FlightOffer>(
    getFlightSupplier,
    (provider) =>
      provider.searchFlights({
        origin: p.origin,
        destination: p.destination,
        departDate: p.departDate,
        returnDate: p.returnDate || undefined,
        adults: p.adults,
        cabin: p.cabin,
        currency: p.currency,
      }),
    (mock) =>
      mock.searchFlights({
        origin: p.origin,
        destination: p.destination,
        departDate: p.departDate,
        returnDate: p.returnDate || undefined,
        adults: p.adults,
        cabin: p.cabin,
        currency: p.currency,
      })
  );
  return { ok: true, results, source, degraded };
}

/**
 * Curated Hotelbeds destinations (code verified against the live API). Hotelbeds
 * uses its own destination codes — not all match IATA — so this is an allow-list
 * of confirmed-working ones rather than a guess.
 */
const HOTEL_DESTINATIONS: AirportSuggestion[] = [
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

/** Hotel destination autocomplete (filters the curated Hotelbeds list). */
export async function searchHotelDestinationsAction(
  query: string
): Promise<AirportSuggestion[]> {
  await requireUser();
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];
  return HOTEL_DESTINATIONS.filter(
    (d) =>
      d.iata.toLowerCase().includes(q) ||
      d.city.toLowerCase().includes(q) ||
      d.name.toLowerCase().includes(q)
  ).slice(0, 8);
}

/** Loads rich content (photos, description, address) for one hotel, cache-first. */
export async function getHotelDetailsAction(
  code: string
): Promise<ActionResult<HotelDetails>> {
  await requireUser();
  if (!code) return { ok: false, error: "Missing hotel code" };
  try {
    const data = await getHotelContentCached(code);
    if (!data) return { ok: false, error: "Hotel details not available." };
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not load hotel details.",
    };
  }
}

const roomsSchema = z.object({
  hotelCode: z.string().trim().min(1, "Hotel code required"),
  cityCode: z.string().trim().optional(),
  city: z.string().trim().default(""),
  checkIn: z.string().min(1, "Check-in required"),
  checkOut: z.string().min(1, "Check-out required"),
  adults: z.coerce.number().int().min(1).max(9).default(2),
  rooms: z.coerce.number().int().min(1).max(9).default(1),
  childAges: z.array(z.coerce.number().int().min(0).max(17)).max(9).default([]),
  currency: z.string().default("EUR"),
});

export type HotelRoomsResult = {
  ok: boolean;
  error?: string;
  rooms: HotelRoomRate[];
  degraded: boolean;
};

/**
 * Re-prices every room of one hotel for a specific occupancy + date range.
 * Called on the details page whenever adults / children / child ages / rooms /
 * dates change, so the room table always reflects the live supplier price.
 */
export async function searchHotelRoomsAction(
  input: z.input<typeof roomsSchema>
): Promise<HotelRoomsResult> {
  await requireUser();
  const parsed = roomsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid request",
      rooms: [],
      degraded: false,
    };
  }
  const p = parsed.data;
  const params = {
    hotelCode: p.hotelCode,
    city: p.city,
    cityCode: p.cityCode || undefined,
    checkIn: p.checkIn,
    checkOut: p.checkOut,
    adults: p.adults,
    rooms: p.rooms,
    childAges: p.childAges,
    currency: p.currency,
  };

  if (isHotelbedsConfigured()) {
    try {
      return { ok: true, rooms: await getHotelbedsRates(params), degraded: false };
    } catch (error) {
      console.error("Hotel rates failed, falling back to sample rooms:", error);
    }
  }
  return { ok: true, rooms: mockHotelRates(params), degraded: true };
}

export async function searchHotelsAction(
  input: z.input<typeof hotelSchema>
): Promise<HotelSearchResult> {
  await requireUser();
  const parsed = hotelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid search",
      results: [],
      source: getHotelSupplier().label,
      degraded: false,
    };
  }
  const p = parsed.data;
  const buildParams = {
    city: p.city,
    cityCode: p.cityCode || undefined,
    checkIn: p.checkIn,
    checkOut: p.checkOut,
    adults: p.adults,
    rooms: p.rooms,
    childAges: p.childAges,
    minStars: p.minStars,
    currency: p.currency,
  };
  let { results, source, degraded } = await safeSearch<HotelOffer>(
    getHotelSupplier,
    (provider) => provider.searchHotels(buildParams),
    (mock) => mock.searchHotels(buildParams)
  );
  let estimatedPricing = false;

  // Availability (prices) and Content (photos) are separate Hotelbeds APIs with
  // separate quotas. If availability degraded to mock but Hotelbeds is
  // configured, fall back to REAL hotels from the Content API — real names and
  // real photos — with estimated rates, instead of fully synthetic mock hotels.
  if (degraded && isHotelbedsConfigured()) {
    try {
      // Cache-first (quota-free); fall back to a live Content call on a miss.
      let real = await listHotelOffersCached(buildParams);
      if (real.length === 0) real = await searchHotelbedsContentHotels(buildParams);
      if (real.length > 0) {
        results = real;
        source = "Hotelbeds (live photos · estimated rates)";
        degraded = false;
        estimatedPricing = true;
      }
    } catch (error) {
      console.error("Content hotel list failed, keeping sample data:", error);
    }
  }

  // Show a focused page. Live-availability results carry no photo yet, so enrich
  // them in one batch call; Content-API results already include thumbnails.
  let top = results.slice(0, 40);
  if (!degraded && !estimatedPricing && isHotelbedsConfigured()) {
    const codes = top.map((o) => o.hotelCode).filter(Boolean) as string[];
    if (codes.length > 0) {
      try {
        const enrich = await getHotelbedsContentBatch(codes);
        top = top.map((o) => {
          const e = o.hotelCode ? enrich[o.hotelCode] : undefined;
          return e ? { ...o, thumbnail: e.thumbnail, hotelType: e.hotelType } : o;
        });
      } catch (error) {
        console.error("Hotel enrichment batch failed:", error);
      }
    }
  }

  return { ok: true, results: top, source, degraded, estimatedPricing };
}
