/**
 * Supplier abstraction layer.
 *
 * All flight/hotel sourcing goes through the `SupplierProvider` interface so the
 * rest of the app never talks to Amadeus (or any GDS) directly. Today the app
 * runs on the mock provider; plugging in real Amadeus credentials swaps the
 * implementation with zero changes to the UI, actions or AI tools.
 */

export type SupplierSource = "mock" | "amadeus" | "hotelbeds";

// --- Flights ----------------------------------------------------------------

export type CabinClass = "economy" | "premium" | "business" | "first";

export type FlightSearchParams = {
  /** IATA airport/city code, e.g. "CDG". */
  origin: string;
  /** IATA airport/city code, e.g. "JFK". */
  destination: string;
  /** Departure date, yyyy-mm-dd. */
  departDate: string;
  /** Return date for round trips, yyyy-mm-dd. Omit for one-way. */
  returnDate?: string | undefined;
  adults: number;
  cabin?: CabinClass | undefined;
  currency?: string | undefined;
  maxResults?: number | undefined;
};

export type FlightSegment = {
  from: string;
  to: string;
  departAt: string;
  arriveAt: string;
  carrierCode: string;
  carrierName: string;
  flightNumber: string;
  durationMinutes: number;
};

export type FlightOffer = {
  id: string;
  source: SupplierSource;
  airlineCode: string;
  airlineName: string;
  priceTotal: number;
  currency: string;
  cabin: CabinClass;
  stops: number;
  durationMinutes: number;
  segments: FlightSegment[];
  /** Present for round trips. */
  returnSegments?: FlightSegment[] | undefined;
};

// --- Hotels -----------------------------------------------------------------

export type HotelSearchParams = {
  /** City name (used by the mock) or IATA city code (used by Amadeus), e.g. "Marrakech" / "RAK". */
  city: string;
  /** Optional explicit IATA city code for live providers. */
  cityCode?: string | undefined;
  checkIn: string;
  checkOut: string;
  adults: number;
  rooms?: number | undefined;
  currency?: string | undefined;
  /** Minimum star rating filter. */
  minStars?: number | undefined;
  maxResults?: number | undefined;
};

export type HotelOffer = {
  id: string;
  source: SupplierSource;
  name: string;
  stars: number;
  city: string;
  address?: string | undefined;
  boardType?: string | undefined;
  refundable: boolean;
  pricePerNight: number;
  priceTotal: number;
  nights: number;
  currency: string;
  thumbnailColor?: string | undefined;
  /** Opaque rate identifier required to book this exact rate (Hotelbeds). */
  rateKey?: string | undefined;
};

// --- Provider ---------------------------------------------------------------

export type BookingConfirmation = {
  confirmationNumber: string;
  provider: SupplierSource;
  status: "confirmed";
};

export interface SupplierProvider {
  readonly source: SupplierSource;
  readonly label: string;
  searchFlights(params: FlightSearchParams): Promise<FlightOffer[]>;
  searchHotels(params: HotelSearchParams): Promise<HotelOffer[]>;
  /** Book a previously-found offer. Returns a supplier confirmation number. */
  bookFlight(offer: FlightOffer): Promise<BookingConfirmation>;
  bookHotel(offer: HotelOffer): Promise<BookingConfirmation>;
  /** Cancel a booking by its confirmation number. */
  cancel(confirmationNumber: string): Promise<{ cancelled: boolean }>;
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  const diff = Math.round((b - a) / 86400000);
  return Math.max(1, Number.isFinite(diff) ? diff : 1);
}
