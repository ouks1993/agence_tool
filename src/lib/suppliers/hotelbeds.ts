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
    address?: { content?: string };
    city?: { content?: string };
    postalCode?: string;
    countryCode?: string;
    phones?: Array<{ phoneNumber?: string; phoneType?: string }>;
    email?: string;
    web?: string;
    coordinates?: { latitude?: number; longitude?: number };
    images?: Array<{ path?: string; order?: number; visualOrder?: number }>;
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
    .map((img) => (img.path ? `${PHOTO_BASE}${img.path}` : ""))
    .filter(Boolean)
    .slice(0, 12);

  const phone = h.phones?.find((p) => p.phoneNumber)?.phoneNumber;

  return {
    code: String(h.code),
    name: h.name?.content ?? "",
    category: h.category?.content,
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
type HbHotel = {
  code: number;
  name: string;
  categoryName?: string;
  destinationName?: string;
  zoneName?: string;
  currency?: string;
  minRate?: string;
  rooms?: Array<{ rates?: HbRate[] }>;
};
type HbAvailability = {
  hotels?: { hotels?: HbHotel[] };
};

/**
 * Fetches the first photo for many hotel codes in ONE Content API call. Returns
 * a map of hotel code → image URL, for list thumbnails.
 */
export async function getHotelbedsContentBatch(
  codes: string[]
): Promise<Record<string, string>> {
  if (codes.length === 0) return {};
  const json = await hotelbeds<{
    hotels?: Array<{
      code: number;
      images?: Array<{ path?: string; order?: number; visualOrder?: number }>;
    }>;
  }>(
    `/hotel-content-api/1.0/hotels?codes=${codes.join(
      ","
    )}&language=ENG&fields=images&from=1&to=${codes.length}`
  );
  const map: Record<string, string> = {};
  for (const h of json.hotels ?? []) {
    const first = (h.images ?? [])
      .slice()
      .sort((a, b) => (a.visualOrder ?? a.order ?? 99) - (b.visualOrder ?? b.order ?? 99))[0];
    if (first?.path) map[String(h.code)] = `${PHOTO_BASE}${first.path}`;
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
      const rate = h.rooms?.[0]?.rates?.[0];
      const total = parseFloat(h.minRate ?? rate?.net ?? "0");
      if (!total) continue;
      offers.push({
        id: `hotelbeds-ht-${h.code}`,
        source: "hotelbeds",
        name: h.name,
        stars: parseStars(h.categoryName),
        city: h.destinationName ?? params.city,
        address: h.zoneName,
        boardType: rate?.boardName,
        // RT = refundable rate class; NRF = non-refundable.
        refundable: rate?.rateClass !== "NRF",
        pricePerNight: Math.round((total / nights) * 100) / 100,
        priceTotal: total,
        nights,
        currency: h.currency ?? params.currency ?? "EUR",
        rateKey: rate?.rateKey,
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
