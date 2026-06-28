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
  | "content";

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

/**
 * A concrete provider is its descriptor plus whichever capability interfaces it
 * supports. Callers narrow with the `supports*` type guards in ./registry.ts
 * (e.g. `if (canSearchHotels(p)) p.searchHotels(...)`).
 */
export type BookingProvider = ProviderDescriptor &
  Partial<
    HotelSearchCapable &
      HotelBookingCapable &
      FlightSearchCapable &
      FlightBookingCapable &
      CancelCapable
  >;
