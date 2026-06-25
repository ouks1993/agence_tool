import { createHash } from "node:crypto";
import { nightsBetween } from "./types";
import type {
  BookingConfirmation,
  FlightOffer,
  FlightSearchParams,
  HotelDetails,
  HotelOffer,
  HotelRoomRate,
  HotelSearchParams,
  SupplierProvider,
} from "./types";

/** Hotelbeds serves photos from this CDN; `bigger` is a good display size. */
const PHOTO_BASE = "https://photos.hotelbeds.com/giata/bigger/";

type HbContent = {
  hotel?: {
    code: number;
    name?: { content?: string };
    description?: { content?: string };
    category?: { content?: string };
    /** The list endpoint returns the rating as a code, e.g. "3EST". */
    categoryCode?: string;
    accommodationType?: { typeDescription?: string };
    address?: { content?: string };
    city?: { content?: string };
    postalCode?: string;
    countryCode?: string;
    phones?: Array<{ phoneNumber?: string; phoneType?: string }>;
    email?: string;
    web?: string;
    coordinates?: { latitude?: number; longitude?: number };
    segments?: Array<{ description?: { content?: string } }>;
    facilities?: Array<{
      description?: { content?: string };
      indYesOrNo?: boolean;
    }>;
    images?: Array<{
      path?: string;
      order?: number;
      visualOrder?: number;
      roomCode?: string;
    }>;
  };
};

/**
 * Fetches rich hotel content (photos, description, address) for one hotel code
 * via the Hotelbeds Content API. Same auth as the booking API.
 */
export async function getHotelbedsContent(code: string): Promise<HotelDetails> {
  const json = await hotelbeds<HbContent>(
    `/hotel-content-api/1.0/hotels/${code}/details?language=ENG`
  );
  const h = json.hotel;
  if (!h) throw new Error("Hotel content not found");
  return mapHbContent(h);
}

/** Maps one Hotelbeds content hotel (single- or list-endpoint shape) to HotelDetails. */
function mapHbContent(h: NonNullable<HbContent["hotel"]>): HotelDetails {
  const images = (h.images ?? [])
    .slice()
    .sort((a, b) => (a.visualOrder ?? a.order ?? 99) - (b.visualOrder ?? b.order ?? 99))
    .filter((img) => img.path)
    .map((img) => ({ url: `${PHOTO_BASE}${img.path}`, roomCode: img.roomCode }))
    .slice(0, 40);

  const phone = h.phones?.find((p) => p.phoneNumber)?.phoneNumber;

  const segments = (h.segments ?? [])
    .map((s) => s.description?.content)
    .filter((x): x is string => Boolean(x));

  // Only boolean "has it" amenities, de-duplicated, capped for display.
  const facilities = Array.from(
    new Set(
      (h.facilities ?? [])
        .filter((f) => f.indYesOrNo === true && f.description?.content)
        .map((f) => f.description!.content as string)
    )
  ).slice(0, 24);

  return {
    code: String(h.code),
    name: h.name?.content ?? "",
    // Single endpoint returns category.content; list endpoint returns categoryCode.
    category: h.category?.content ?? h.categoryCode,
    hotelType: h.accommodationType?.typeDescription,
    description: h.description?.content,
    address: h.address?.content,
    city: h.city?.content,
    country: h.countryCode,
    postalCode: h.postalCode,
    phone,
    email: h.email,
    web: h.web,
    latitude: h.coordinates?.latitude,
    longitude: h.coordinates?.longitude,
    segments,
    facilities,
    images,
  };
}

/**
 * Fetches a page of FULL hotel content for one destination (used by the content
 * sync). One call returns up to `to - from + 1` hotels with all their images and
 * facilities, so a handful of calls caches an entire destination.
 */
export async function fetchHotelbedsContentPage(
  destinationCode: string,
  from: number,
  to: number
): Promise<HotelDetails[]> {
  const json = await hotelbeds<{ hotels?: NonNullable<HbContent["hotel"]>[] }>(
    `/hotel-content-api/1.0/hotels?destinationCode=${destinationCode}` +
      `&language=ENG&fields=all&from=${from}&to=${to}`
  );
  return (json.hotels ?? []).map(mapHbContent);
}

/**
 * Hotelbeds (APITUDE) hotel provider.
 *
 * Activated when HOTELBEDS_API_KEY and HOTELBEDS_SECRET are set. Uses the test
 * host by default; set HOTELBEDS_HOSTNAME=production for live inventory.
 *
 * Auth: every request carries `Api-key` plus an `X-Signature` =
 * SHA256(apiKey + secret + unixSeconds). Booking a rate requires the `rateKey`
 * returned by availability, which is why HotelOffer now carries one.
 *
 * Docs: https://developer.hotelbeds.com
 */

function host(): string {
  return process.env.HOTELBEDS_HOSTNAME === "production"
    ? "https://api.hotelbeds.com"
    : "https://api.test.hotelbeds.com";
}

/** Builds the per-request signature header Hotelbeds requires. */
function signature(): { apiKey: string; xSignature: string } {
  const apiKey = process.env.HOTELBEDS_API_KEY ?? "";
  const secret = process.env.HOTELBEDS_SECRET ?? "";
  const ts = Math.floor(Date.now() / 1000);
  const xSignature = createHash("sha256")
    .update(apiKey + secret + ts)
    .digest("hex");
  return { apiKey, xSignature };
}

async function hotelbeds<T>(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const { apiKey, xSignature } = signature();
  const res = await fetch(`${host()}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "Api-key": apiKey,
      "X-Signature": xSignature,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Hotelbeds ${path} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

type HbCancellationPolicy = { from?: string; amount?: string };
type HbRate = {
  rateKey?: string;
  net?: string;
  boardName?: string;
  rateClass?: string;
  adults?: number;
  children?: number;
  cancellationPolicies?: HbCancellationPolicy[];
};
type HbRoom = { code?: string; name?: string; rates?: HbRate[] };
type HbHotel = {
  code: number;
  name: string;
  categoryName?: string;
  destinationName?: string;
  zoneName?: string;
  currency?: string;
  minRate?: string;
  rooms?: HbRoom[];
};
type HbAvailability = {
  hotels?: { hotels?: HbHotel[] };
};

export type HotelEnrichment = {
  thumbnail?: string | undefined;
  hotelType?: string | undefined;
};

/**
 * Fetches a thumbnail + accommodation type for many hotel codes in ONE Content
 * API call. Returns a map of hotel code → enrichment, for list cards/filters.
 */
export async function getHotelbedsContentBatch(
  codes: string[]
): Promise<Record<string, HotelEnrichment>> {
  if (codes.length === 0) return {};
  const json = await hotelbeds<{
    hotels?: Array<{
      code: number;
      accommodationType?: { typeDescription?: string };
      images?: Array<{ path?: string; order?: number; visualOrder?: number }>;
    }>;
  }>(
    `/hotel-content-api/1.0/hotels?codes=${codes.join(
      ","
    )}&language=ENG&fields=images,accommodationType&from=1&to=${codes.length}`
  );
  const map: Record<string, HotelEnrichment> = {};
  for (const h of json.hotels ?? []) {
    const first = (h.images ?? [])
      .slice()
      .sort((a, b) => (a.visualOrder ?? a.order ?? 99) - (b.visualOrder ?? b.order ?? 99))[0];
    map[String(h.code)] = {
      thumbnail: first?.path ? `${PHOTO_BASE}${first.path}` : undefined,
      hotelType: h.accommodationType?.typeDescription,
    };
  }
  return map;
}

/**
 * Fetches every bookable room+rate for ONE hotel, priced for the supplied
 * occupancy. Re-run whenever occupancy or dates change so the details-page room
 * table always reflects the live supplier price for that exact party.
 */
export async function getHotelbedsRates(
  params: HotelSearchParams & { hotelCode: string }
): Promise<HotelRoomRate[]> {
  const nights = nightsBetween(params.checkIn, params.checkOut);
  const json = await hotelbeds<HbAvailability>("/hotel-api/1.0/hotels", {
    method: "POST",
    body: {
      stay: { checkIn: params.checkIn, checkOut: params.checkOut },
      occupancies: buildOccupancies(params),
      hotels: { hotel: [Number(params.hotelCode)] },
    },
  });

  const hotel = json.hotels?.hotels?.[0];
  if (!hotel) return [];
  const currency = hotel.currency ?? params.currency ?? "EUR";

  const rates: HotelRoomRate[] = [];
  for (const room of hotel.rooms ?? []) {
    for (const rate of room.rates ?? []) {
      const net = parseFloat(rate.net ?? "0");
      if (!(net > 0)) continue;
      rates.push({
        id: rate.rateKey ?? `${room.code}-${rate.boardName}-${net}`,
        rateKey: rate.rateKey,
        roomCode: room.code,
        roomName: room.name ?? "Room",
        boardType: rate.boardName,
        refundable: rate.rateClass !== "NRF",
        adults: rate.adults ?? Math.max(1, params.adults),
        children: rate.children ?? (params.childAges?.length ?? 0),
        priceTotal: net,
        pricePerNight: Math.round((net / nights) * 100) / 100,
        nights,
        currency,
        cancellationDeadline: cancellationDeadline(rate),
      });
    }
  }
  return rates.sort((a, b) => a.priceTotal - b.priceTotal);
}

/** "4 EST" / "4 STARS" → 4. */
function parseStars(category?: string): number {
  const m = category ? /(\d)/.exec(category) : null;
  return m ? parseInt(m[1]!, 10) : 0;
}

/**
 * Builds the Hotelbeds `occupancies` block from the search params. Children are
 * sent as a count plus a `paxes` list carrying each child's age, because the
 * rate (and therefore the price) depends on the ages, not just the headcount.
 */
function buildOccupancies(params: HotelSearchParams) {
  const childAges = params.childAges ?? [];
  return [
    {
      rooms: params.rooms ?? 1,
      adults: Math.max(1, params.adults),
      children: childAges.length,
      ...(childAges.length
        ? { paxes: childAges.map((age) => ({ type: "CH", age })) }
        : {}),
    },
  ];
}

/** Earliest free-cancellation deadline across a rate's policies, ISO string. */
function cancellationDeadline(rate: HbRate): string | undefined {
  const froms = (rate.cancellationPolicies ?? [])
    .map((p) => p.from)
    .filter((x): x is string => Boolean(x))
    .sort();
  return froms[0];
}

/** A rough 0–10 guest score derived deterministically from rating + code. */
export function estimatedReviewScore(stars: number, code: number): number {
  const base = 6.5 + stars * 0.55; // 3★≈8.1 … 5★≈9.2
  const jitter = ((code % 7) - 3) * 0.1;
  return Math.min(9.9, Math.max(6, Math.round((base + jitter) * 10) / 10));
}

/** Parses a Hotelbeds category string/code ("4 STARS", "3EST") to a star count. */
export function parseStarsValue(category?: string): number {
  return parseStars(category);
}

/** Plausible, deterministic nightly estimate when no live rate is available. */
export function estimatedNightly(stars: number, code: number): number {
  const base = 55 + stars * stars * 13;
  const jitter = 0.85 + ((code % 30) / 30) * 0.5;
  return Math.round(base * jitter);
}

type HbContentListHotel = {
  code: number;
  name?: { content?: string };
  categoryCode?: string;
  accommodationType?: { typeDescription?: string };
  address?: { content?: string };
  city?: { content?: string };
  coordinates?: { latitude?: number; longitude?: number };
  images?: Array<{ path?: string; order?: number; visualOrder?: number }>;
};

/**
 * Lists REAL hotels for a destination from the Content API — names, stars,
 * address, coordinates and real photos — independent of availability. Used as a
 * fallback when the availability/booking API is unavailable (e.g. quota), so the
 * results still show real hotels and real images. Prices are estimated and
 * flagged (`estimated: true`) because no live rate is returned here.
 */
export async function searchHotelbedsContentHotels(
  params: HotelSearchParams
): Promise<HotelOffer[]> {
  const destinationCode = (params.cityCode || params.city).toUpperCase();
  if (!destinationCode) return [];
  const nights = nightsBetween(params.checkIn, params.checkOut);
  const rooms = Math.max(1, params.rooms ?? 1);
  const max = Math.min(params.maxResults ?? 30, 50);

  const json = await hotelbeds<{ hotels?: HbContentListHotel[] }>(
    `/hotel-content-api/1.0/hotels?destinationCode=${destinationCode}` +
      `&language=ENG&fields=name,categoryCode,accommodationType,address,city,coordinates,images` +
      `&from=1&to=${max}`
  );

  const offers: HotelOffer[] = [];
  for (const h of json.hotels ?? []) {
    const first = (h.images ?? [])
      .slice()
      .sort((a, b) => (a.visualOrder ?? a.order ?? 99) - (b.visualOrder ?? b.order ?? 99))[0];
    // Only surface hotels we can actually show a photo for.
    if (!first?.path) continue;
    const stars = parseStars(h.categoryCode);
    const perNight = estimatedNightly(stars, h.code) * rooms;
    offers.push({
      id: `hotelbeds-ct-${h.code}`,
      source: "hotelbeds",
      name: h.name?.content ?? `Hotel ${h.code}`,
      stars,
      city: h.city?.content ?? params.city,
      address: h.address?.content,
      refundable: true,
      pricePerNight: perNight,
      priceTotal: perNight * nights,
      nights,
      currency: params.currency ?? "EUR",
      thumbnail: `${PHOTO_BASE}${first.path}`,
      hotelType: h.accommodationType?.typeDescription,
      hotelCode: String(h.code),
      latitude: h.coordinates?.latitude,
      longitude: h.coordinates?.longitude,
      reviewScore: estimatedReviewScore(stars, h.code),
      estimated: true,
    });
  }
  return offers.sort((a, b) => b.stars - a.stars);
}

export class HotelbedsSupplier implements SupplierProvider {
  readonly source = "hotelbeds" as const;
  readonly label = "Hotelbeds (live)";

  // Hotelbeds is a hotel-only provider; flights run through Amadeus.
  async searchFlights(_params: FlightSearchParams): Promise<FlightOffer[]> {
    return [];
  }

  async searchHotels(params: HotelSearchParams): Promise<HotelOffer[]> {
    const nights = nightsBetween(params.checkIn, params.checkOut);
    // Hotelbeds keys availability by its own destination codes. Prefer an
    // explicit code; otherwise pass the city string (callers can supply the
    // resolved code via cityCode for live use).
    const destinationCode = (params.cityCode || params.city).toUpperCase();

    const body = {
      stay: { checkIn: params.checkIn, checkOut: params.checkOut },
      occupancies: buildOccupancies(params),
      destination: { code: destinationCode },
      ...(params.minStars ? { filter: { minCategory: params.minStars } } : {}),
    };

    const json = await hotelbeds<HbAvailability>("/hotel-api/1.0/hotels", {
      method: "POST",
      body,
    });

    const offers: HotelOffer[] = [];
    for (const h of json.hotels?.hotels ?? []) {
      // Pick the cheapest rate across all rooms so price, room and rateKey stay
      // consistent (the hotel-level minRate may belong to any room).
      let best: { net: number; room: HbRoom; rate: HbRate } | null = null;
      for (const room of h.rooms ?? []) {
        for (const rate of room.rates ?? []) {
          const net = parseFloat(rate.net ?? "0");
          if (net > 0 && (!best || net < best.net)) best = { net, room, rate };
        }
      }
      const total = best ? best.net : parseFloat(h.minRate ?? "0");
      if (!total) continue;
      offers.push({
        id: `hotelbeds-ht-${h.code}`,
        source: "hotelbeds",
        name: h.name,
        stars: parseStars(h.categoryName),
        city: h.destinationName ?? params.city,
        address: h.zoneName,
        boardType: best?.rate.boardName,
        roomName: best?.room.name,
        roomCode: best?.room.code,
        // NRF = non-refundable; anything else is refundable.
        refundable: best?.rate.rateClass !== "NRF",
        pricePerNight: Math.round((total / nights) * 100) / 100,
        priceTotal: total,
        nights,
        currency: h.currency ?? params.currency ?? "EUR",
        rateKey: best?.rate.rateKey,
        hotelCode: String(h.code),
        reviewScore: estimatedReviewScore(parseStars(h.categoryName), h.code),
      });
    }
    return offers.sort((a, b) => a.priceTotal - b.priceTotal);
  }

  async bookFlight(): Promise<BookingConfirmation> {
    throw new Error("Hotelbeds does not book flights");
  }

  async bookHotel(offer: HotelOffer): Promise<BookingConfirmation> {
    if (!offer.rateKey) {
      throw new Error("Missing rateKey — cannot book this Hotelbeds rate");
    }
    type HbBookingResponse = { booking?: { reference?: string } };
    const json = await hotelbeds<HbBookingResponse>("/hotel-api/1.0/bookings", {
      method: "POST",
      body: {
        holder: { name: "Travel", surname: "Agency" },
        rooms: [
          {
            rateKey: offer.rateKey,
            paxes: [{ roomId: 1, type: "AD", name: "Guest", surname: "1" }],
          },
        ],
        clientReference: `ATLAS-${Date.now().toString(36).toUpperCase()}`,
      },
    });
    const reference = json.booking?.reference;
    if (!reference) throw new Error("Hotelbeds booking returned no reference");
    return { confirmationNumber: reference, provider: "hotelbeds", status: "confirmed" };
  }

  async cancel(confirmationNumber: string): Promise<{ cancelled: boolean }> {
    await hotelbeds(`/hotel-api/1.0/bookings/${confirmationNumber}`, {
      method: "DELETE",
    });
    return { cancelled: true };
  }
}
