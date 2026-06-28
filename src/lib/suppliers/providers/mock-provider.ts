/**
 * Mock booking provider — the always-available development/fallback provider
 * implemented against the capability-segmented `BookingProvider` contract
 * (./types.ts).
 *
 * Unlike the real adapters (Duffel, Hotelbeds), this provider has no
 * credentials and is ALWAYS configured, so the registry's `pick()` can fall
 * back to it whenever a real provider for a vertical is missing or unconfigured
 * (it sits at priority 0 — the lowest — so real providers at priority 50 always
 * outrank it). It implements the FULL set of capabilities across BOTH verticals
 * (search → quote → book → cancel) so the entire booking lifecycle is demoable
 * offline.
 *
 * Search delegates to the existing `MockSupplier` (../mock.ts) so the
 * deterministic RNG and sample data live in exactly one place. Quote/book/cancel
 * are deterministic and side-effect free: rates never expire or change, and the
 * same `idempotencyKey` always yields the same confirmation number, which
 * demonstrates idempotency without any backing store.
 */

import { MockSupplier } from "../mock";
import {
  ProviderError,
  type AutocompleteCapable,
  type BookingResult,
  type CancelCapable,
  type CancelResult,
  type ContentCapable,
  type FlightBookingCapable,
  type FlightBookingRequest,
  type FlightSearchCapable,
  type HotelBookingCapable,
  type HotelBookingRequest,
  type HotelContentParams,
  type HotelEnrichment,
  type HotelSearchCapable,
  type PlaceSuggestion,
  type ProviderBookingRef,
  type ProviderContext,
  type ProviderDescriptor,
  type RateQuote,
} from "./types";
import type {
  FlightOffer,
  FlightSearchParams,
  HotelOffer,
  HotelSearchParams,
} from "../types";

/** Mock quotes are nominally valid for 15 minutes (they never actually expire). */
const QUOTE_TTL_MS = 15 * 60 * 1000;

/**
 * Stable 6-char uppercase token derived from a string, so the same
 * `idempotencyKey` always produces the same confirmation number (offline
 * idempotency demonstration). FNV-1a, base36-encoded.
 */
function shortToken(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
}

export class MockBookingProvider
  implements
    ProviderDescriptor,
    FlightSearchCapable,
    FlightBookingCapable,
    HotelSearchCapable,
    HotelBookingCapable,
    CancelCapable,
    ContentCapable,
    AutocompleteCapable
{
  readonly id = "mock" as const;
  readonly label = "Mock";
  readonly verticals = ["flights", "hotels"] as const;
  readonly capabilities = [
    "search",
    "quote",
    "book",
    "cancel",
    "content",
    "autocomplete",
  ] as const;
  /** Lowest priority — the fallback. Real providers at priority 50 outrank it. */
  readonly priority = 0;

  /** Single delegate for all search calls — owns the deterministic mock data. */
  private readonly supplier = new MockSupplier();

  /** Always available: the mock has no credentials to configure. */
  isConfigured(): boolean {
    return true;
  }

  async searchFlights(
    params: FlightSearchParams,
    _ctx: ProviderContext
  ): Promise<FlightOffer[]> {
    return this.supplier.searchFlights(params);
  }

  async searchHotels(
    params: HotelSearchParams,
    _ctx: ProviderContext
  ): Promise<HotelOffer[]> {
    return this.supplier.searchHotels(params);
  }

  async quoteFlight(
    offer: FlightOffer,
    _ctx: ProviderContext
  ): Promise<RateQuote> {
    // Mock rates never expire or change — return the offer's price verbatim.
    return {
      quoteId: offer.id,
      providerId: "mock",
      vertical: "flights",
      priceTotal: offer.priceTotal,
      currency: offer.currency,
      refundable: true,
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
      priceChanged: false,
    };
  }

  async quoteHotel(
    offer: HotelOffer,
    _ctx: ProviderContext
  ): Promise<RateQuote> {
    // Mock rates never expire or change — return the offer's price verbatim.
    return {
      quoteId: offer.rateKey ?? offer.id,
      providerId: "mock",
      vertical: "hotels",
      priceTotal: offer.priceTotal,
      currency: offer.currency,
      refundable: offer.refundable,
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
      priceChanged: false,
    };
  }

  async bookFlight(
    req: FlightBookingRequest,
    _ctx: ProviderContext
  ): Promise<BookingResult> {
    const { offer } = req;
    return {
      ref: {
        providerId: "mock",
        // Derived from the idempotencyKey: replaying the same key yields the
        // same confirmation number, demonstrating idempotency offline.
        confirmationNumber: `MK-FL-${shortToken(req.idempotencyKey)}`,
        raw: { idempotencyKey: req.idempotencyKey },
      },
      status: "confirmed",
      priceTotal: offer.priceTotal,
      currency: offer.currency,
    };
  }

  async bookHotel(
    req: HotelBookingRequest,
    _ctx: ProviderContext
  ): Promise<BookingResult> {
    const { offer } = req;
    if (req.guests.length === 0) {
      throw new ProviderError(
        "mock",
        "validation",
        "At least one guest is required to book",
        false
      );
    }
    return {
      ref: {
        providerId: "mock",
        // Same key → same confirmation number (offline idempotency).
        confirmationNumber: `MK-HT-${shortToken(req.idempotencyKey)}`,
        raw: { idempotencyKey: req.idempotencyKey },
      },
      status: "confirmed",
      priceTotal: offer.priceTotal,
      currency: offer.currency,
    };
  }

  async cancel(
    _ref: ProviderBookingRef,
    _ctx: ProviderContext
  ): Promise<CancelResult> {
    // The mock never charges a penalty and always cancels successfully.
    return { cancelled: true };
  }

  // --- ContentCapable -------------------------------------------------------

  /**
   * Name-based hotel search. Delegates to the deterministic supplier using the
   * query as the city, so results are stable HotelOffers whose names embed the
   * query (the supplier composes names as `{brand} {city} {suffix}`).
   */
  async searchHotelsByName(
    query: string,
    _ctx: ProviderContext
  ): Promise<HotelOffer[]> {
    const today = new Date();
    const checkIn = today.toISOString().slice(0, 10);
    const checkOut = new Date(today.getTime() + 86400000)
      .toISOString()
      .slice(0, 10);
    const offers = await this.supplier.searchHotels({
      city: query,
      checkIn,
      checkOut,
      adults: 2,
      rooms: 1,
    });
    return offers.slice(0, 3);
  }

  /**
   * Static enrichment for each requested code — no live content provider, so we
   * return sensible placeholders keyed to the code (name, 4 stars, empty media).
   */
  async fetchHotelContent(
    codes: string[],
    _ctx: ProviderContext
  ): Promise<HotelEnrichment[]> {
    return codes.map((code) => ({
      code,
      name: "Mock Hotel",
      stars: 4,
      images: [],
      facilities: [],
    }));
  }

  /**
   * Room rates for a single hotel. Delegates to the supplier using the content
   * params (check-in/out + occupancy) so the returned HotelOffers are
   * deterministic and priced for the stay.
   */
  async fetchRoomRates(
    params: HotelContentParams,
    _ctx: ProviderContext
  ): Promise<HotelOffer[]> {
    const offers = await this.supplier.searchHotels({
      city: params.hotelCode,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      adults: params.adults ?? 2,
      rooms: params.rooms ?? 1,
      currency: params.currency,
    });
    return offers.slice(0, 3);
  }

  // --- AutocompleteCapable --------------------------------------------------

  /**
   * Static airport suggestions whose names embed the query, so autocomplete is
   * demoable offline without a live places provider.
   */
  async searchAirports(
    query: string,
    _ctx: ProviderContext
  ): Promise<PlaceSuggestion[]> {
    return [
      {
        iataCode: "CDG",
        name: `Paris Charles de Gaulle (${query})`,
        cityName: "Paris",
        countryName: "France",
        type: "airport",
      },
      {
        iataCode: "ALG",
        name: `Algiers Houari Boumediene (${query})`,
        cityName: "Algiers",
        countryName: "Algeria",
        type: "airport",
      },
      {
        iataCode: "LHR",
        name: `London Heathrow (${query})`,
        cityName: "London",
        countryName: "United Kingdom",
        type: "airport",
      },
    ];
  }
}
