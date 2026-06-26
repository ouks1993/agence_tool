/**
 * Supplier abstraction layer.
 *
 * All flight/hotel sourcing goes through the `SupplierProvider` interface so the
 * rest of the app never talks to Amadeus (or any GDS) directly. Today the app
 * runs on the mock provider; plugging in real Amadeus credentials swaps the
 * implementation with zero changes to the UI, actions or AI tools.
 */

export type SupplierSource = "mock" | "amadeus" | "hotelbeds" | "duffel";

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
  /**
   * Raw provider offer id (e.g. Duffel `ofr_...`), without the internal
   * `duffel-fl-` prefix applied to `id`. Required to create a real order.
   */
  rawOfferId?: string | undefined;
};

/**
 * A passenger on a flight order. Mirrors the subset of Duffel's order-passenger
 * shape the booking flow needs; ignored by suppliers that don't book live.
 */
export type FlightPassenger = {
  type: "adult";
  given_name: string;
  family_name: string;
  /** Date of birth, YYYY-MM-DD. */
  born_on: string;
  gender: "m" | "f";
  identity_documents?: Array<{
    type: "passport";
    unique_identifier: string;
    /** 2-letter ISO issuing country code. */
    issuing_country_code: string;
    /** Passport expiry, YYYY-MM-DD. */
    expires_on: string;
  }>;
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
  /** Ages (years) of each child in the party — drives occupancy pricing. */
  childAges?: number[] | undefined;
  currency?: string | undefined;
  /** Minimum star rating filter. */
  minStars?: number | undefined;
  maxResults?: number | undefined;
  /** Restrict availability to a single hotel code (used by the details page). */
  hotelCode?: string | undefined;
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
  /** First photo URL, attached from content for list thumbnails. */
  thumbnail?: string | undefined;
  /** Accommodation type, e.g. "Hotel" / "Hostel" / "Apartment". */
  hotelType?: string | undefined;
  /** Name of the cheapest room for this price, e.g. "Classic Double". */
  roomName?: string | undefined;
  /** Provider room code (prefix maps to a room category, e.g. DBL → Double). */
  roomCode?: string | undefined;
  /** Opaque rate identifier required to book this exact rate (Hotelbeds). */
  rateKey?: string | undefined;
  /** Provider hotel code, used to fetch rich content (photos, description). */
  hotelCode?: string | undefined;
  /** Latitude/longitude when known, for distance-from-centre sorting/filters. */
  latitude?: number | undefined;
  longitude?: number | undefined;
  /** 0–10 guest review score (estimated from rating when no live review feed). */
  reviewScore?: number | undefined;
  /**
   * True when the price is an estimate (real hotel + photos sourced from the
   * Content API, but live availability/pricing was unavailable).
   */
  estimated?: boolean | undefined;
};

/**
 * A single bookable room+rate for one hotel, priced for a specific occupancy.
 * Powers the room-availability table on the details page; re-fetched whenever
 * occupancy or dates change so the price always reflects the live supplier rate.
 */
export type HotelRoomRate = {
  /** Stable id for React keys (rateKey when present, else a composed string). */
  id: string;
  /** Opaque rate identifier required to book this exact rate (Hotelbeds). */
  rateKey?: string | undefined;
  roomCode?: string | undefined;
  roomName: string;
  boardType?: string | undefined;
  refundable: boolean;
  /** Occupancy this rate was priced for. */
  adults: number;
  children: number;
  priceTotal: number;
  pricePerNight: number;
  nights: number;
  currency: string;
  /** Free-cancellation deadline (ISO) when the rate is refundable. */
  cancellationDeadline?: string | undefined;
};

/** A single image with an optional room association. */
export type HotelImage = { url: string; roomCode?: string | undefined };

/** Rich hotel content (photos, description, address, amenities) from content API. */
export type HotelDetails = {
  code: string;
  name: string;
  category?: string | undefined;
  hotelType?: string | undefined;
  description?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  country?: string | undefined;
  postalCode?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  web?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  /** Marketing tags, e.g. "Business hotels", "Hotels with charm". */
  segments: string[];
  /** Amenity names present at the property. */
  facilities: string[];
  /** All images, each optionally tagged with a room code. */
  images: HotelImage[];
};

// --- Airport / place autocomplete -------------------------------------------

export type AirportSuggestion = {
  /** IATA code used as the search value, e.g. "CDG". */
  iata: string;
  /** Airport (or city) name, e.g. "Charles de Gaulle". */
  name: string;
  /** City name, e.g. "Paris". */
  city: string;
  /** ISO country code, e.g. "FR". */
  country: string;
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
  /**
   * Book a previously-found offer. Returns a supplier confirmation number.
   * `passengers` is required by live providers (Duffel) to create a real order;
   * mock/legacy providers ignore it.
   */
  bookFlight(
    offer: FlightOffer,
    passengers?: FlightPassenger[]
  ): Promise<BookingConfirmation>;
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
