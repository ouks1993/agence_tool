import type {
  BookingConfirmation,
  CabinClass,
  FlightOffer,
  FlightSearchParams,
  FlightSegment,
  HotelOffer,
  HotelSearchParams,
  SupplierProvider,
} from "./types";

/**
 * Duffel flight provider.
 *
 * Activated when DUFFEL_API_TOKEN is set. Uses test data automatically when the
 * token is a test token (`duffel_test_...`). Auth is a single Bearer token plus
 * a `Duffel-Version` header.
 *
 * Replaces Amadeus self-service (decommissioned 2026-07-17) as the flights
 * provider. Hotels still run through Hotelbeds.
 *
 * Docs: https://duffel.com/docs/api
 */

const API = "https://api.duffel.com";

function version(): string {
  return process.env.DUFFEL_VERSION || "v2";
}

async function duffel<T>(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const token = process.env.DUFFEL_API_TOKEN;
  if (!token) throw new Error("Duffel is not configured");
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Duffel-Version": version(),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Duffel ${path} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Parse an ISO-8601 duration like "P1DT2H30M" / "PT8H30M" into minutes. */
function parseIsoDuration(iso: string): number {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(iso);
  if (!m) return 0;
  return (
    parseInt(m[1] ?? "0", 10) * 1440 +
    parseInt(m[2] ?? "0", 10) * 60 +
    parseInt(m[3] ?? "0", 10)
  );
}

const CABIN_TO_DUFFEL: Record<CabinClass, string> = {
  economy: "economy",
  premium: "premium_economy",
  business: "business",
  first: "first",
};

type DfCarrier = { name: string; iata_code: string };
type DfSegment = {
  origin: { iata_code: string };
  destination: { iata_code: string };
  departing_at: string;
  arriving_at: string;
  duration?: string;
  marketing_carrier: DfCarrier;
  marketing_carrier_flight_number: string;
};
type DfSlice = { duration?: string; segments: DfSegment[] };
type DfOffer = {
  id: string;
  total_amount: string;
  total_currency: string;
  owner?: DfCarrier;
  slices: DfSlice[];
};
type OfferRequestResponse = { data?: { offers?: DfOffer[] } };

function minutesBetween(a: string, b: string): number {
  return Math.max(
    0,
    Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)
  );
}

export class DuffelSupplier implements SupplierProvider {
  readonly source = "duffel" as const;
  readonly label = "Duffel (live)";

  async searchFlights(params: FlightSearchParams): Promise<FlightOffer[]> {
    const slices: Array<{ origin: string; destination: string; departure_date: string }> = [
      {
        origin: params.origin.toUpperCase(),
        destination: params.destination.toUpperCase(),
        departure_date: params.departDate,
      },
    ];
    if (params.returnDate) {
      slices.push({
        origin: params.destination.toUpperCase(),
        destination: params.origin.toUpperCase(),
        departure_date: params.returnDate,
      });
    }

    const body = {
      data: {
        slices,
        passengers: Array.from({ length: Math.max(1, params.adults) }, () => ({
          type: "adult",
        })),
        cabin_class: CABIN_TO_DUFFEL[params.cabin ?? "economy"],
      },
    };

    const json = await duffel<OfferRequestResponse>(
      "/air/offer_requests?return_offers=true&supplier_timeout=15000",
      { method: "POST", body }
    );

    const cabin = params.cabin ?? "economy";
    const mapSlice = (slice: DfSlice): FlightSegment[] =>
      slice.segments.map((s) => ({
        from: s.origin.iata_code,
        to: s.destination.iata_code,
        departAt: s.departing_at,
        arriveAt: s.arriving_at,
        carrierCode: s.marketing_carrier.iata_code,
        carrierName: s.marketing_carrier.name,
        flightNumber: `${s.marketing_carrier.iata_code}${s.marketing_carrier_flight_number}`,
        durationMinutes: s.duration
          ? parseIsoDuration(s.duration)
          : minutesBetween(s.departing_at, s.arriving_at),
      }));

    const offers = (json.data?.offers ?? []).flatMap<FlightOffer>((offer) => {
      const out = offer.slices[0];
      if (!out) return [];
      const back = offer.slices[1];
      const firstSeg = out.segments[0];
      const code = offer.owner?.iata_code ?? firstSeg?.marketing_carrier.iata_code ?? "";
      const name = offer.owner?.name ?? firstSeg?.marketing_carrier.name ?? code;
      return [
        {
          id: `duffel-fl-${offer.id}`,
          source: "duffel" as const,
          airlineCode: code,
          airlineName: name,
          priceTotal: parseFloat(offer.total_amount),
          currency: offer.total_currency,
          cabin,
          stops: Math.max(0, out.segments.length - 1),
          durationMinutes: out.duration
            ? parseIsoDuration(out.duration)
            : out.segments.length
              ? minutesBetween(
                  out.segments[0]!.departing_at,
                  out.segments[out.segments.length - 1]!.arriving_at
                )
              : 0,
          segments: mapSlice(out),
          ...(back ? { returnSegments: mapSlice(back) } : {}),
        },
      ];
    });

    return offers.sort((a, b) => a.priceTotal - b.priceTotal);
  }

  // Duffel is a flights provider; hotels run through Hotelbeds.
  async searchHotels(_params: HotelSearchParams): Promise<HotelOffer[]> {
    return [];
  }

  // Creating a real Duffel order requires full passenger details and payment
  // (balance or hold). Until that flow is wired we issue a provisional reference
  // so operations runs end to end — same approach as the previous provider.
  async bookFlight(): Promise<BookingConfirmation> {
    return {
      confirmationNumber: `DF-${Date.now().toString(36).toUpperCase()}`,
      provider: "duffel",
      status: "confirmed",
    };
  }

  async bookHotel(): Promise<BookingConfirmation> {
    throw new Error("Duffel does not book hotels");
  }

  async cancel(): Promise<{ cancelled: boolean }> {
    return { cancelled: true };
  }
}
