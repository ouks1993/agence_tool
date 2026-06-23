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

// --- deterministic RNG so the same search returns stable results ------------

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AIRLINES = [
  { code: "AF", name: "Air France" },
  { code: "BA", name: "British Airways" },
  { code: "LH", name: "Lufthansa" },
  { code: "EK", name: "Emirates" },
  { code: "QR", name: "Qatar Airways" },
  { code: "TK", name: "Turkish Airlines" },
  { code: "AT", name: "Royal Air Maroc" },
  { code: "IB", name: "Iberia" },
];

const CABIN_MULTIPLIER: Record<CabinClass, number> = {
  economy: 1,
  premium: 1.6,
  business: 2.8,
  first: 4.5,
};

const HOTEL_BRANDS = [
  "Grand",
  "Riad",
  "Royal",
  "Boutique",
  "Le Méridien",
  "Atlas",
  "Marina",
  "Palace",
  "Sofitel",
  "Kasbah",
];
const HOTEL_SUFFIX = ["Resort & Spa", "Hotel", "Suites", "Palace", "Retreat", "Inn"];
const BOARD_TYPES = ["Room only", "Bed & breakfast", "Half board", "All inclusive"];
const HOTEL_COLORS = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#6366f1"];

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

function buildSegments(
  rand: () => number,
  origin: string,
  destination: string,
  dateStr: string,
  airline: { code: string; name: string },
  baseDuration: number,
  stops: number
): FlightSegment[] {
  const hour = String(6 + Math.floor(rand() * 14)).padStart(2, "0");
  const minute = rand() < 0.5 ? "05" : "40";
  const depart = new Date(`${dateStr}T${hour}:${minute}:00`);
  const segments: FlightSegment[] = [];
  const hub = ["IST", "DXB", "CDG", "FRA", "DOH", "MAD"][Math.floor(rand() * 6)] ?? "IST";
  const legs: Array<[string, string]> =
    stops === 0 ? [[origin, destination]] : [[origin, hub], [hub, destination]];
  let cursor = depart;
  legs.forEach((leg, idx) => {
    const dur = Math.round(baseDuration / legs.length);
    const arrive = addMinutes(cursor, dur);
    segments.push({
      from: leg[0],
      to: leg[1],
      departAt: cursor.toISOString(),
      arriveAt: arrive.toISOString(),
      carrierCode: airline.code,
      carrierName: airline.name,
      flightNumber: `${airline.code}${100 + Math.floor(rand() * 8900)}`,
      durationMinutes: dur,
    });
    // layover before next leg
    cursor = addMinutes(arrive, idx < legs.length - 1 ? 60 + Math.floor(rand() * 90) : 0);
  });
  return segments;
}

export class MockSupplier implements SupplierProvider {
  readonly source = "mock" as const;
  readonly label = "Sample data";

  async searchFlights(params: FlightSearchParams): Promise<FlightOffer[]> {
    const origin = params.origin.toUpperCase().slice(0, 3);
    const destination = params.destination.toUpperCase().slice(0, 3);
    const cabin = params.cabin ?? "economy";
    const currency = params.currency ?? "EUR";
    const count = Math.min(params.maxResults ?? 6, 12);
    const seed = hashString(
      `${origin}-${destination}-${params.departDate}-${params.returnDate ?? ""}-${cabin}`
    );
    const rand = mulberry32(seed);

    // Base duration & price scale derived from the route hash.
    const baseDuration = 95 + (hashString(origin + destination) % 700);
    const basePrice = 70 + (hashString(destination + origin) % 380);

    const offers: FlightOffer[] = [];
    for (let i = 0; i < count; i++) {
      const airline = AIRLINES[Math.floor(rand() * AIRLINES.length)]!;
      const stops = rand() < 0.55 ? 0 : 1;
      const durationOut = Math.round(baseDuration * (stops ? 1.4 : 1) * (0.9 + rand() * 0.3));
      const perAdult =
        basePrice *
        CABIN_MULTIPLIER[cabin] *
        (stops ? 0.82 : 1.12) *
        (0.85 + rand() * 0.5) *
        (params.returnDate ? 1.85 : 1);
      const priceTotal = Math.round(perAdult * Math.max(1, params.adults));

      const segments = buildSegments(rand, origin, destination, params.departDate, airline, durationOut, stops);
      let returnSegments: FlightSegment[] | undefined;
      if (params.returnDate) {
        returnSegments = buildSegments(
          rand,
          destination,
          origin,
          params.returnDate,
          airline,
          Math.round(durationOut * (0.95 + rand() * 0.2)),
          stops
        );
      }

      offers.push({
        id: `mock-fl-${seed}-${i}`,
        source: "mock",
        airlineCode: airline.code,
        airlineName: airline.name,
        priceTotal,
        currency,
        cabin,
        stops,
        durationMinutes: durationOut,
        segments,
        returnSegments,
      });
    }
    return offers.sort((a, b) => a.priceTotal - b.priceTotal);
  }

  async searchHotels(params: HotelSearchParams): Promise<HotelOffer[]> {
    const city = params.city.trim();
    const currency = params.currency ?? "EUR";
    const nights = nightsBetween(params.checkIn, params.checkOut);
    const rooms = Math.max(1, params.rooms ?? 1);
    const count = Math.min(params.maxResults ?? 8, 14);
    const seed = hashString(`${city.toLowerCase()}-${params.checkIn}-${params.checkOut}`);
    const rand = mulberry32(seed);

    const offers: HotelOffer[] = [];
    for (let i = 0; i < count; i++) {
      const stars = 3 + Math.floor(rand() * 3); // 3..5
      const brand = HOTEL_BRANDS[Math.floor(rand() * HOTEL_BRANDS.length)];
      const suffix = HOTEL_SUFFIX[Math.floor(rand() * HOTEL_SUFFIX.length)];
      const pricePerNight = Math.round(
        (45 + stars * stars * 11) * (0.8 + rand() * 0.8) * rooms
      );
      if (params.minStars && stars < params.minStars) continue;
      offers.push({
        id: `mock-ht-${seed}-${i}`,
        source: "mock",
        name: `${brand} ${city} ${suffix}`,
        stars,
        city,
        address: `${10 + Math.floor(rand() * 200)} Avenue ${brand}, ${city}`,
        boardType: BOARD_TYPES[Math.floor(rand() * BOARD_TYPES.length)],
        refundable: rand() < 0.7,
        pricePerNight,
        priceTotal: pricePerNight * nights,
        nights,
        currency,
        thumbnailColor: HOTEL_COLORS[Math.floor(rand() * HOTEL_COLORS.length)],
      });
    }
    return offers.sort((a, b) => a.priceTotal - b.priceTotal);
  }

  async bookFlight(): Promise<BookingConfirmation> {
    return { confirmationNumber: mockRef("FL"), provider: "mock", status: "confirmed" };
  }

  async bookHotel(): Promise<BookingConfirmation> {
    return { confirmationNumber: mockRef("HT"), provider: "mock", status: "confirmed" };
  }

  async cancel(): Promise<{ cancelled: boolean }> {
    return { cancelled: true };
  }
}

function mockRef(prefix: string): string {
  return `MK-${prefix}-${Date.now().toString(36).toUpperCase()}`;
}
