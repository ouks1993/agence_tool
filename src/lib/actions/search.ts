"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import { requireUser } from "@/lib/permissions";
import {
  getHotelbedsRates,
  isHotelbedsConfigured,
  mockHotelRates,
  type AirportSuggestion,
  type FlightOffer,
  type HotelDetails,
  type HotelOffer,
  type HotelRoomRate,
} from "@/lib/suppliers";
import { getHotelContentCached } from "@/lib/suppliers/content-cache";
import {
  searchAirports,
  searchFlights,
  searchHotelDestinations,
  searchHotels,
  type ProviderContext,
} from "@/lib/travel-platform";

/**
 * Airport / city autocomplete. Delegates to the Travel Platform facade, which
 * routes through the configured autocomplete provider and falls back to a
 * static list so the field still suggests in dev / when unconfigured.
 */
export async function searchAirportsAction(
  query: string
): Promise<AirportSuggestion[]> {
  const user = await requireUser();
  const ctx: ProviderContext = { agencyId: user.agencyId ?? "" };
  return searchAirports(query, ctx);
}

const flightSchema = z.object({
  origin: z.string().trim().min(3, "Origin code required").max(3),
  destination: z.string().trim().min(3, "Destination code required").max(3),
  departDate: z.string().min(1, "Departure date required"),
  returnDate: z.string().optional(),
  adults: z.coerce.number().int().min(1).max(9).default(1),
  cabin: z.enum(["economy", "premium", "business", "first"]).default("economy"),
  currency: z.string().default("DZD"),
});

const hotelSchema = z.object({
  city: z.string().trim().default(""),
  cityCode: z.string().trim().optional(),
  checkIn: z.string().min(1, "Check-in required"),
  checkOut: z.string().min(1, "Check-out required"),
  adults: z.coerce.number().int().min(1).max(9).default(2),
  rooms: z.coerce.number().int().min(1).max(9).default(1),
  /** Ages of each child (0–17). Length is the child count sent to the supplier. */
  childAges: z.array(z.coerce.number().int().min(0).max(17)).max(9).default([]),
  minStars: z.coerce.number().int().min(0).max(5).optional(),
  currency: z.string().default("DZD"),
  /** Free-text hotel name — when set, search by name (destination becomes optional). */
  hotelName: z.string().trim().optional(),
}).refine(
  (d) => d.hotelName || d.city.length >= 2,
  { message: "Enter a destination or hotel name", path: ["city"] }
);

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
  const user = await requireUser();
  const parsed = flightSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid search",
      results: [],
      source: "Mock",
      degraded: false,
    };
  }
  const p = parsed.data;
  const ctx: ProviderContext = {
    agencyId: user.agencyId ?? "",
    currency: p.currency,
  };
  const { results, source, degraded } = await searchFlights(
    {
      origin: p.origin,
      destination: p.destination,
      departDate: p.departDate,
      returnDate: p.returnDate || undefined,
      adults: p.adults,
      cabin: p.cabin,
      currency: p.currency,
    },
    ctx
  );
  return { ok: true, results, source, degraded };
}

/** Hotel destination autocomplete (filters the curated list in the facade). */
export async function searchHotelDestinationsAction(
  query: string
): Promise<AirportSuggestion[]> {
  await requireUser();
  return searchHotelDestinations(query);
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
  currency: z.string().default("DZD"),
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
  const user = await requireUser();
  const parsed = hotelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid search",
      results: [],
      source: "Mock",
      degraded: false,
    };
  }
  const p = parsed.data;
  const ctx: ProviderContext = {
    agencyId: user.agencyId ?? "",
    currency: p.currency,
  };
  const result = await searchHotels(
    {
      city: p.city,
      cityCode: p.cityCode || undefined,
      checkIn: p.checkIn,
      checkOut: p.checkOut,
      adults: p.adults,
      rooms: p.rooms,
      childAges: p.childAges,
      minStars: p.minStars,
      currency: p.currency,
      ...(p.hotelName ? { hotelName: p.hotelName } : {}),
    },
    ctx
  );
  return {
    ok: true,
    results: result.results,
    source: result.source,
    degraded: result.degraded,
    ...(result.estimatedPricing !== undefined
      ? { estimatedPricing: result.estimatedPricing }
      : {}),
  };
}
