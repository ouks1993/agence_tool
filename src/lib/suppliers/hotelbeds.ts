import { createHash } from "node:crypto";
import { nightsBetween } from "./types";
import type {
  BookingConfirmation,
  FlightOffer,
  FlightSearchParams,
  HotelDetails,
  HotelOffer,
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
    category: h.category?.content,
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

type HbRate = {
  rateKey?: string;
  net?: string;
  boardName?: string;
  rateClass?: string;
  cancellationPolicies?: unknown[];
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

/** "4 EST" / "4 STARS" → 4. */
function parseStars(category?: string): number {
  const m = category ? /(\d)/.exec(category) : null;
  return m ? parseInt(m[1]!, 10) : 0;
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
      occupancies: [
        {
          rooms: params.rooms ?? 1,
          adults: Math.max(1, params.adults),
          children: 0,
        },
      ],
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
