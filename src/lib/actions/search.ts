"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import { requireUser } from "@/lib/permissions";
import {
  getFlightSupplier,
  getHotelSupplier,
  getHotelbedsContent,
  isDuffelConfigured,
  isHotelbedsConfigured,
  safeSearch,
  searchDuffelPlaces,
  type AirportSuggestion,
  type FlightOffer,
  type HotelDetails,
  type HotelOffer,
} from "@/lib/suppliers";

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

/** Loads rich content (photos, description, address) for one hotel. */
export async function getHotelDetailsAction(
  code: string
): Promise<ActionResult<HotelDetails>> {
  await requireUser();
  if (!code) return { ok: false, error: "Missing hotel code" };
  if (!isHotelbedsConfigured()) {
    return { ok: false, error: "Hotel details require a live provider." };
  }
  try {
    return { ok: true, data: await getHotelbedsContent(code) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not load hotel details.",
    };
  }
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
    minStars: p.minStars,
    currency: p.currency,
  };
  const { results, source, degraded } = await safeSearch<HotelOffer>(
    getHotelSupplier,
    (provider) => provider.searchHotels(buildParams),
    (mock) => mock.searchHotels(buildParams)
  );
  return { ok: true, results, source, degraded };
}
