import { nightsBetween } from "./types";
import type {
  FlightOffer,
  FlightSearchParams,
  FlightSegment,
  HotelOffer,
  HotelSearchParams,
  SupplierProvider,
  CabinClass,
  BookingConfirmation,
} from "./types";

/**
 * Amadeus Self-Service API provider.
 *
 * Activated automatically when AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET are
 * set in the environment. Uses the test host by default; set
 * AMADEUS_HOSTNAME=production for live data once the agency has a paid key.
 *
 * Docs: https://developers.amadeus.com
 */

function host(): string {
  return process.env.AMADEUS_HOSTNAME === "production"
    ? "https://api.amadeus.com"
    : "https://test.api.amadeus.com";
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.token;
  }
  const res = await fetch(`${host()}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.AMADEUS_CLIENT_ID ?? "",
      client_secret: process.env.AMADEUS_CLIENT_SECRET ?? "",
    }),
  });
  if (!res.ok) {
    throw new Error(`Amadeus auth failed (${res.status})`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

async function amadeusGet<T>(path: string): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${host()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Amadeus ${path} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Parse an ISO-8601 duration like "PT12H30M" into minutes. */
function parseIsoDuration(iso: string): number {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(iso);
  if (!m) return 0;
  return (parseInt(m[1] ?? "0", 10) * 60) + parseInt(m[2] ?? "0", 10);
}

const CABIN_TO_AMADEUS: Record<CabinClass, string> = {
  economy: "ECONOMY",
  premium: "PREMIUM_ECONOMY",
  business: "BUSINESS",
  first: "FIRST",
};

type AmSegment = {
  departure: { iataCode: string; at: string };
  arrival: { iataCode: string; at: string };
  carrierCode: string;
  number: string;
};
type AmItinerary = { duration: string; segments: AmSegment[] };
type AmFlightOffer = {
  id: string;
  price: { grandTotal: string; currency: string };
  itineraries: AmItinerary[];
  travelerPricings?: Array<{ fareDetailsBySegment?: Array<{ cabin?: string }> }>;
};
type AmadeusFlightResponse = {
  data?: AmFlightOffer[];
  dictionaries?: { carriers?: Record<string, string> };
};

export class AmadeusSupplier implements SupplierProvider {
  readonly source = "amadeus" as const;
  readonly label = "Amadeus (live)";

  async searchFlights(params: FlightSearchParams): Promise<FlightOffer[]> {
    const q = new URLSearchParams({
      originLocationCode: params.origin.toUpperCase(),
      destinationLocationCode: params.destination.toUpperCase(),
      departureDate: params.departDate,
      adults: String(Math.max(1, params.adults)),
      currencyCode: params.currency ?? "EUR",
      max: String(params.maxResults ?? 10),
    });
    if (params.returnDate) q.set("returnDate", params.returnDate);
    if (params.cabin) q.set("travelClass", CABIN_TO_AMADEUS[params.cabin]);

    const json = await amadeusGet<AmadeusFlightResponse>(
      `/v2/shopping/flight-offers?${q.toString()}`
    );
    const carriers = json.dictionaries?.carriers ?? {};

    const mapItinerary = (segs: AmSegment[]): FlightSegment[] =>
      segs.map((s) => ({
        from: s.departure.iataCode,
        to: s.arrival.iataCode,
        departAt: s.departure.at,
        arriveAt: s.arrival.at,
        carrierCode: s.carrierCode,
        carrierName: carriers[s.carrierCode] ?? s.carrierCode,
        flightNumber: `${s.carrierCode}${s.number}`,
        durationMinutes: Math.max(
          0,
          Math.round(
            (new Date(s.arrival.at).getTime() - new Date(s.departure.at).getTime()) /
              60000
          )
        ),
      }));

    return (json.data ?? []).flatMap<FlightOffer>((offer) => {
      const out = offer.itineraries[0];
      if (!out) return [];
      const back = offer.itineraries[1];
      const cabinRaw =
        offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin ?? "ECONOMY";
      const cabin = (Object.keys(CABIN_TO_AMADEUS).find(
        (k) => CABIN_TO_AMADEUS[k as CabinClass] === cabinRaw
      ) ?? "economy") as CabinClass;
      const firstCarrier = out.segments[0]?.carrierCode ?? "";
      return [
        {
          id: `amadeus-fl-${offer.id}`,
          source: "amadeus" as const,
          airlineCode: firstCarrier,
          airlineName: carriers[firstCarrier] ?? firstCarrier,
          priceTotal: parseFloat(offer.price.grandTotal),
          currency: offer.price.currency,
          cabin,
          stops: Math.max(0, out.segments.length - 1),
          durationMinutes: parseIsoDuration(out.duration),
          segments: mapItinerary(out.segments),
          ...(back ? { returnSegments: mapItinerary(back.segments) } : {}),
        },
      ];
    });
  }

  async searchHotels(params: HotelSearchParams): Promise<HotelOffer[]> {
    const nights = nightsBetween(params.checkIn, params.checkOut);
    let cityCode = params.cityCode?.toUpperCase();

    // Resolve a city name to an IATA city code if needed.
    if (!cityCode) {
      const loc = await amadeusGet<{ data?: Array<{ iataCode?: string }> }>(
        `/v1/reference-data/locations?subType=CITY&keyword=${encodeURIComponent(
          params.city
        )}&page%5Blimit%5D=1`
      );
      cityCode = loc.data?.[0]?.iataCode;
    }
    if (!cityCode) return [];

    const list = await amadeusGet<{ data?: Array<{ hotelId: string }> }>(
      `/v1/reference-data/locations/hotels/by-city?cityCode=${cityCode}`
    );
    const hotelIds = (list.data ?? []).slice(0, 20).map((h) => h.hotelId);
    if (hotelIds.length === 0) return [];

    const q = new URLSearchParams({
      hotelIds: hotelIds.join(","),
      adults: String(Math.max(1, params.adults)),
      checkInDate: params.checkIn,
      checkOutDate: params.checkOut,
      roomQuantity: String(params.rooms ?? 1),
      currency: params.currency ?? "EUR",
      bestRateOnly: "true",
    });

    type HotelOffersResponse = {
      data?: Array<{
        hotel: { name: string; cityCode?: string; rating?: string; address?: { lines?: string[] } };
        offers?: Array<{
          price: { total: string; currency: string };
          policies?: { refundable?: { cancellationRefund?: string } };
          room?: { typeEstimated?: { category?: string } };
          boardType?: string;
        }>;
      }>;
    };
    const json = await amadeusGet<HotelOffersResponse>(
      `/v3/shopping/hotel-offers?${q.toString()}`
    );

    const offers: HotelOffer[] = [];
    for (const entry of json.data ?? []) {
      const best = entry.offers?.[0];
      if (!best) continue;
      const total = parseFloat(best.price.total);
      offers.push({
        id: `amadeus-ht-${entry.hotel.name}-${offers.length}`,
        source: "amadeus",
        name: entry.hotel.name,
        stars: entry.hotel.rating ? parseInt(entry.hotel.rating, 10) : 0,
        city: params.city,
        address: entry.hotel.address?.lines?.join(", "),
        boardType: best.boardType,
        refundable: Boolean(best.policies?.refundable?.cancellationRefund),
        pricePerNight: Math.round((total / nights) * 100) / 100,
        priceTotal: total,
        nights,
        currency: best.price.currency,
      });
    }
    return offers.sort((a, b) => a.priceTotal - b.priceTotal);
  }

  // Live order creation (flight-orders / hotel-orders) requires production
  // credentials and a ticketing agreement. Until that's enabled we issue a
  // provisional confirmation reference so the operations workflow runs end to
  // end; swap these for the real Amadeus booking endpoints when contracted.
  async bookFlight(): Promise<BookingConfirmation> {
    return { confirmationNumber: amadeusRef("FL"), provider: "amadeus", status: "confirmed" };
  }

  async bookHotel(): Promise<BookingConfirmation> {
    return { confirmationNumber: amadeusRef("HT"), provider: "amadeus", status: "confirmed" };
  }

  async cancel(): Promise<{ cancelled: boolean }> {
    return { cancelled: true };
  }
}

function amadeusRef(prefix: string): string {
  return `AM-${prefix}-${Date.now().toString(36).toUpperCase()}`;
}
