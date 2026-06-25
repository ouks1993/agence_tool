"use server";

import { z } from "zod";
import { requireUser } from "@/lib/permissions";
import {
  getFlightSupplier,
  getHotelSupplier,
  safeSearch,
  type FlightOffer,
  type HotelOffer,
} from "@/lib/suppliers";

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
