/**
 * Production provider abstraction (interfaces only — no provider logic here).
 *
 * The existing `SupplierProvider` (../types.ts) forces every provider to
 * implement BOTH verticals and only models search + a single book step. This
 * layer generalizes that so any booking provider — Hotelbeds, Amadeus,
 * TravelgateX, Booking.com, Expedia, or a future one — plugs into the same
 * contract by implementing ONLY the capabilities it actually offers, and is
 * discovered through the registry (./registry.ts) instead of hardcoded if/else.
 *
 * Design rules:
 *  - **Capability-segmented.** A hotels-only aggregator implements the hotel
 *    interfaces and nothing else. No empty `searchFlights` stubs.
 *  - **Full booking lifecycle.** search → quote (revalidate price/rate) → book
 *    (idempotent) → cancel. Real GDS/bedbank rates expire and must be re-priced.
 *  - **Normalized errors.** Providers throw `ProviderError` with a stable code
 *    so callers handle "rate expired" / "sold out" / "rate limited" uniformly.
 *  - **Tenant-aware context.** Every call carries a `ProviderContext` so logging,
 *    idempotency and per-agency credentials are first-class.
 *
 * Normalized search/offer DTOs (FlightOffer, HotelOffer, *SearchParams,
 * FlightPassenger) are reused from ../types.ts — they are already provider-neutral.
 */

import type {
  FlightOffer,
  FlightPassenger,
  FlightSearchParams,
  HotelOffer,
  HotelSearchParams,
} from "../types";

// --- Identity & taxonomy ----------------------------------------------------

/**
 * Known provider ids. Open-ended (`string & {}`) so a new provider can be added
 * without editing this union — the registry is the source of truth at runtime.
 */
export type ProviderId =
  | "mock"
  | "duffel"
  | "amadeus"
  | "hotelbeds"
  | "travelgatex"
  | "booking_com"
  | "expedia"
  | (string & {});

export type ProviderVertical = "flights" | "hotels";

/** What a provider can do. A provider advertises the subset it supports. */
export type ProviderCapability =
  | "search"
  | "quote"
  | "book"
  | "cancel"
  | "content"
  | "autocomplete";

// --- Call context -----------------------------------------------------------

/**
 * Passed to every provider call. Carries tenant scope, presentation prefs, and
 * tracing/cancellation so providers never read globals.
 */
export type ProviderContext = {
  /** Tenant the request is made on behalf of (for per-agency creds + logging). */
  agencyId: string;
  /** Preferred ISO currency for pricing, e.g. "DZD". */
  currency?: string | undefined;
  /** Preferred locale for content, e.g. "en". */
  locale?: string | undefined;
  /** Correlation id for tracing a request across providers/logs. */
  correlationId?: string | undefined;
  /** Abort signal for timeouts / user cancellation. */
  signal?: AbortSignal | undefined;
};

// --- Booking lifecycle DTOs -------------------------------------------------

/** A re-validated, time-boxed price for a specific offer/rate before booking. */
export type RateQuote = {
  /** Opaque token to pass to the matching `book*` call. */
  quoteId: string;
  providerId: ProviderId;
  vertical: ProviderVertical;
  priceTotal: number;
  currency: string;
  refundable: boolean;
  /** ISO instant after which this quote is no longer valid. */
  expiresAt: string;
  /** Free-cancellation deadline (ISO) when refundable. */
  cancellationDeadline?: string | undefined;
  /** True when the price changed vs the search result. */
  priceChanged?: boolean | undefined;
};

/** Idempotent hotel booking request. */
export type HotelBookingRequest = {
  /** Quote returned by `quoteHotel`, or the offer's `rateKey` for direct book. */
  quoteId?: string | undefined;
  offer: HotelOffer;
  guests: GuestDetails[];
  /** Caller-generated key; replaying the same key must NOT double-book. */
  idempotencyKey: string;
  /** Agency-side reference (e.g. BKG-…) for cross-linking. */
  agencyReference?: string | undefined;
};

/** Idempotent flight booking request. */
export type FlightBookingRequest = {
  quoteId?: string | undefined;
  offer: FlightOffer;
  passengers: FlightPassenger[];
  idempotencyKey: string;
  agencyReference?: string | undefined;
};

export type GuestDetails = {
  givenName: string;
  familyName: string;
  /** "lead" guest is the primary contact for the room. */
  lead?: boolean | undefined;
};

/** Result of a successful booking. */
export type BookingResult = {
  ref: ProviderBookingRef;
  status: "confirmed" | "pending";
  priceTotal: number;
  currency: string;
};

/** Everything needed to later reference/cancel a booking with the provider. */
export type ProviderBookingRef = {
  providerId: ProviderId;
  /** Provider's confirmation/PNR/locator. */
  confirmationNumber: string;
  /** Opaque provider payload needed for cancellation, if any. */
  raw?: unknown;
};

export type CancelResult = {
  cancelled: boolean;
  /** Penalty charged on cancellation, if any. */
  penaltyAmount?: number | undefined;
  currency?: string | undefined;
};

// --- Normalized error model -------------------------------------------------

export type ProviderErrorCode =
  | "auth" // bad/expired credentials
  | "validation" // malformed request
  | "rate_expired" // quote/rate no longer valid → re-quote
  | "sold_out" // availability gone
  | "rate_limited" // provider throttled us → backoff
  | "provider_unavailable" // upstream down/timeout
  | "not_supported" // capability not offered
  | "unknown";

/** All providers throw this so callers branch on `code`, not provider strings. */
export class ProviderError extends Error {
  constructor(
    readonly providerId: ProviderId,
    readonly code: ProviderErrorCode,
    message: string,
    /** Whether a retry (after backoff / re-quote) could succeed. */
    readonly retryable: boolean = false,
    override readonly cause?: unknown
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

// --- Capability interfaces (implement only what a provider offers) ----------

/** Identity + configuration. Every provider implements this. */
export interface ProviderDescriptor {
  readonly id: ProviderId;
  readonly label: string;
  readonly verticals: readonly ProviderVertical[];
  readonly capabilities: readonly ProviderCapability[];
  /** Higher wins when several providers serve the same vertical. */
  readonly priority: number;
  /** True when credentials/config for this provider are present. */
  isConfigured(): boolean;
}

export interface HotelSearchCapable {
  searchHotels(
    params: HotelSearchParams,
    ctx: ProviderContext
  ): Promise<HotelOffer[]>;
}

export interface HotelBookingCapable {
  /** Re-validate price/availability for an offer immediately before booking. */
  quoteHotel(offer: HotelOffer, ctx: ProviderContext): Promise<RateQuote>;
  bookHotel(
    req: HotelBookingRequest,
    ctx: ProviderContext
  ): Promise<BookingResult>;
}

export interface FlightSearchCapable {
  searchFlights(
    params: FlightSearchParams,
    ctx: ProviderContext
  ): Promise<FlightOffer[]>;
}

export interface FlightBookingCapable {
  quoteFlight(offer: FlightOffer, ctx: ProviderContext): Promise<RateQuote>;
  bookFlight(
    req: FlightBookingRequest,
    ctx: ProviderContext
  ): Promise<BookingResult>;
}

export interface CancelCapable {
  cancel(ref: ProviderBookingRef, ctx: ProviderContext): Promise<CancelResult>;
}

// --- Content & enrichment capability ----------------------------------------

/**
 * Provider-neutral hotel enrichment payload (photos, facilities, coordinates).
 * Providers map their own content schema to this shape.
 */
export type HotelEnrichment = {
  code: string;
  name?: string | undefined;
  stars?: number | undefined;
  images?: { url: string; roomCode?: string }[] | undefined;
  facilities?: string[] | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  destinationCode?: string | undefined;
};

/** Parameters for fetching per-hotel room rates (single-property detail page). */
export type HotelContentParams = {
  hotelCode: string;
  checkIn: string;
  checkOut: string;
  adults?: number | undefined;
  rooms?: number | undefined;
  currency?: string | undefined;
};

/**
 * Content, enrichment, and name-search capabilities.
 * Implemented by providers that expose a hotel content/metadata API
 * (e.g. Hotelbeds Content API, Expedia Content API).
 */
export interface ContentCapable {
  /** Search hotels by name string → returns priced offers (or estimated). */
  searchHotelsByName(query: string, ctx: ProviderContext): Promise<HotelOffer[]>;
  /** Fetch enrichment data (photos, facilities, coords) for a list of hotel codes. */
  fetchHotelContent(codes: string[], ctx: ProviderContext): Promise<HotelEnrichment[]>;
  /** Fetch room rates for a single hotel (detail/room-picker page). */
  fetchRoomRates(params: HotelContentParams, ctx: ProviderContext): Promise<HotelOffer[]>;
}

// --- Autocomplete capability -------------------------------------------------

/** A single airport/place suggestion (provider-neutral). */
export type PlaceSuggestion = {
  iataCode: string;
  name: string;
  cityName?: string | undefined;
  countryName?: string | undefined;
  type?: string | undefined;
};

/**
 * Airport and destination autocomplete.
 * Implemented by providers that have a places/suggestions API (e.g. Duffel).
 */
export interface AutocompleteCapable {
  /** Suggest airports / cities matching a free-text query. */
  searchAirports(query: string, ctx: ProviderContext): Promise<PlaceSuggestion[]>;
}

// --- Composed provider type -------------------------------------------------

/**
 * A concrete provider is its descriptor plus whichever capability interfaces it
 * supports. Callers narrow with the type guards in ./registry.ts
 * (e.g. `if (canSearchHotels(p)) p.searchHotels(...)`).
 */
export type BookingProvider = ProviderDescriptor &
  Partial<
    HotelSearchCapable &
      HotelBookingCapable &
      FlightSearchCapable &
      FlightBookingCapable &
      CancelCapable &
      ContentCapable &
      AutocompleteCapable
  >;
