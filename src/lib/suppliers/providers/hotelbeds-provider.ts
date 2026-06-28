/**
 * Hotelbeds (APITUDE) booking provider — registry-driven implementation.
 *
 * This is the production `BookingProvider` shape of the legacy
 * `HotelbedsSupplier` (../hotelbeds.ts). It implements only the hotel
 * capabilities Hotelbeds actually offers (search → quote → book → cancel) and
 * is discovered through the provider registry rather than hardcoded if/else.
 *
 * Differences from the legacy supplier:
 *  - Credentials/hostname come from `getHotelProviderConfig()`, never
 *    `process.env` directly, so per-environment resolution lives in one place.
 *  - Every upstream failure is normalized to a `ProviderError` with a stable
 *    `code`, so callers branch on "rate expired" / "auth" / "rate limited"
 *    uniformly instead of parsing provider strings.
 *  - Adds a real `quoteHotel` (CheckRate) step to re-price a rate immediately
 *    before booking, because bedbank rates expire and Hotelbeds regenerates the
 *    `rateKey` on every CheckRate.
 *
 * Auth: every request carries `Api-key` plus an `X-Signature` =
 * SHA256(apiKey + secret + unixSeconds). Booking a rate requires the `rateKey`
 * returned by availability.
 *
 * Docs: https://developer.hotelbeds.com
 */

import { createHash } from "node:crypto";
import { getHotelProviderConfig } from "../config";
import {
  ProviderError,
  type BookingResult,
  type CancelCapable,
  type CancelResult,
  type ContentCapable,
  type HotelBookingCapable,
  type HotelBookingRequest,
  type HotelContentParams,
  type HotelEnrichment,
  type HotelSearchCapable,
  type ProviderBookingRef,
  type ProviderContext,
  type ProviderDescriptor,
  type RateQuote,
} from "./types";
import {
  getHotelbedsContentBatch,
  getHotelbedsRates,
  searchHotelbedsHotelsByName,
} from "../hotelbeds";
import { nightsBetween } from "../types";
import type { HotelOffer, HotelSearchParams } from "../types";

/** Hard cap on any upstream Hotelbeds call so a hung provider can't pin a
 * request to Vercel's 30s function ceiling. */
const FETCH_TIMEOUT_MS = 15000;

/** A CheckRate quote is valid for 15 minutes before it must be re-priced. */
const QUOTE_TTL_MS = 15 * 60 * 1000;

/** Default occupancy when a content call doesn't carry one (name search). */
const DEFAULT_ADULTS = 2;

/** How far out to default a synthesized stay window when none is supplied. */
const DEFAULT_STAY_OFFSET_DAYS = 30;

/**
 * The Content name-search endpoint needs a stay window to price results, but
 * `ContentCapable.searchHotelsByName` only carries the query. Synthesize a
 * single-night window ~30 days out so callers still get live (not estimated)
 * pricing when availability exists. Dates are ISO `YYYY-MM-DD`.
 */
function defaultStayWindow(): { checkIn: string; checkOut: string } {
  const day = 24 * 60 * 60 * 1000;
  const checkIn = new Date(Date.now() + DEFAULT_STAY_OFFSET_DAYS * day);
  const checkOut = new Date(checkIn.getTime() + day);
  return {
    checkIn: checkIn.toISOString().slice(0, 10),
    checkOut: checkOut.toISOString().slice(0, 10),
  };
}

// --- Hotelbeds API shapes (only the fields we consume) ----------------------

type HbCancellationPolicy = { from?: string; amount?: string };

type HbRate = {
  rateKey?: string;
  net?: string;
  boardName?: string;
  rateClass?: string;
  adults?: number;
  children?: number;
  cancellationPolicies?: HbCancellationPolicy[];
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

type HbCheckRateResponse = {
  hotel?: {
    rooms?: Array<{
      rates?: Array<{
        rateKey?: string;
        net?: string;
        rateClass?: string;
        cancellationPolicies?: Array<{ from?: string; amount?: string }>;
      }>;
    }>;
  };
};

type HbBooking = { reference?: string; totalNet?: string };

type HbBookingResponse = { booking?: HbBooking };

type HbCancelResponse = { booking?: { cancellationAmount?: string } };

// --- Local helpers (copied from ../hotelbeds.ts — they are not exported) -----

/** "4 EST" / "4 STARS" → 4. */
function parseStars(category?: string): number {
  const m = category ? /(\d)/.exec(category) : null;
  return m ? parseInt(m[1]!, 10) : 0;
}

/**
 * Builds the Hotelbeds `occupancies` block from the search params. Children are
 * sent as a count plus a `paxes` list carrying each child's age, because the
 * rate (and therefore the price) depends on the ages, not just the headcount.
 */
function buildOccupancies(params: HotelSearchParams) {
  const childAges = params.childAges ?? [];
  return [
    {
      rooms: params.rooms ?? 1,
      adults: Math.max(1, params.adults),
      children: childAges.length,
      ...(childAges.length
        ? { paxes: childAges.map((age) => ({ type: "CH", age })) }
        : {}),
    },
  ];
}

/** Earliest free-cancellation deadline across a rate's policies, ISO string. */
function cancellationDeadline(rate: {
  cancellationPolicies?: Array<{ from?: string }>;
}): string | undefined {
  const froms = (rate.cancellationPolicies ?? [])
    .map((p) => p.from)
    .filter((x): x is string => Boolean(x))
    .sort();
  return froms[0];
}

/** A rough 0–10 guest score derived deterministically from rating + code. */
function estimatedReviewScore(stars: number, code: number): number {
  const base = 6.5 + stars * 0.55; // 3★≈8.1 … 5★≈9.2
  const jitter = ((code % 7) - 3) * 0.1;
  return Math.min(9.9, Math.max(6, Math.round((base + jitter) * 10) / 10));
}

// --- Provider ----------------------------------------------------------------

export class HotelbedsBookingProvider
  implements
    ProviderDescriptor,
    HotelSearchCapable,
    HotelBookingCapable,
    CancelCapable,
    ContentCapable
{
  readonly id = "hotelbeds" as const;
  readonly label = "Hotelbeds";
  readonly verticals = ["hotels"] as const;
  readonly capabilities = [
    "search",
    "quote",
    "book",
    "cancel",
    "content",
  ] as const;
  readonly priority = 50;

  /** Configured when credentials resolve to the live Hotelbeds provider. */
  isConfigured(): boolean {
    return getHotelProviderConfig().provider === "hotelbeds";
  }

  /**
   * Single entry point for every Hotelbeds HTTP call. Resolves credentials +
   * hostname from config (never env), signs the request, and normalizes any
   * failure into a `ProviderError` with a stable code so callers can branch on
   * intent rather than parsing provider strings.
   */
  private async hotelbedsCall<T>(
    path: string,
    init?: { method?: string; body?: unknown },
    ctx?: ProviderContext
  ): Promise<T> {
    const config = getHotelProviderConfig();
    if (config.provider !== "hotelbeds") {
      throw new ProviderError(
        "hotelbeds",
        "auth",
        "Hotelbeds credentials are not configured",
        false
      );
    }

    // Signature is SHA256(apiKey + secret + unixSeconds), regenerated per call.
    const ts = Math.floor(Date.now() / 1000);
    const xSignature = createHash("sha256")
      .update(config.apiKey + config.secret + ts)
      .digest("hex");

    // Honour the caller's abort signal when present; otherwise apply our own
    // timeout so a hung upstream can't pin the function to its ceiling.
    const controller = new AbortController();
    const timeout = ctx?.signal
      ? undefined
      : setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const signal = ctx?.signal ?? controller.signal;

    let res: Response;
    try {
      res = await fetch(`${config.hostname}${path}`, {
        method: init?.method ?? "GET",
        headers: {
          "Api-key": config.apiKey,
          "X-Signature": xSignature,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal,
        ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ProviderError(
          "hotelbeds",
          "provider_unavailable",
          `Hotelbeds ${path} timed out or was aborted`,
          true,
          error
        );
      }
      throw new ProviderError(
        "hotelbeds",
        "provider_unavailable",
        `Hotelbeds ${path} request failed`,
        true,
        error
      );
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const snippet = text.slice(0, 200);

      if (res.status === 401 || res.status === 403) {
        throw new ProviderError(
          "hotelbeds",
          "auth",
          `Hotelbeds ${path} authentication failed (${res.status}): ${snippet}`,
          false
        );
      }
      if (res.status === 429) {
        throw new ProviderError(
          "hotelbeds",
          "rate_limited",
          `Hotelbeds ${path} throttled (429): ${snippet}`,
          true
        );
      }
      if (res.status === 400 && /INVALID_DATA|rate/i.test(text)) {
        // Hotelbeds returns INVALID_DATA / rate-related 400s when a rateKey has
        // expired or been superseded — the rate must be re-quoted.
        throw new ProviderError(
          "hotelbeds",
          "rate_expired",
          `Hotelbeds ${path} rate invalid (400): ${snippet}`,
          false
        );
      }
      throw new ProviderError(
        "hotelbeds",
        "unknown",
        `Hotelbeds ${path} failed (${res.status}): ${snippet}`,
        false
      );
    }

    return (await res.json()) as T;
  }

  async searchHotels(
    params: HotelSearchParams,
    ctx: ProviderContext
  ): Promise<HotelOffer[]> {
    const nights = nightsBetween(params.checkIn, params.checkOut);
    // Hotelbeds keys availability by its own destination codes. Prefer an
    // explicit code; otherwise pass the city string (callers can supply the
    // resolved code via cityCode for live use).
    const destinationCode = (params.cityCode || params.city).toUpperCase();

    const body = {
      stay: { checkIn: params.checkIn, checkOut: params.checkOut },
      occupancies: buildOccupancies(params),
      destination: { code: destinationCode },
      ...(params.minStars ? { filter: { minCategory: params.minStars } } : {}),
    };

    const json = await this.hotelbedsCall<HbAvailability>(
      "/hotel-api/1.0/hotels",
      { method: "POST", body },
      ctx
    );

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
        reviewScore: estimatedReviewScore(parseStars(h.categoryName), h.code),
      });
    }
    return offers.sort((a, b) => a.priceTotal - b.priceTotal);
  }

  /**
   * Re-validates an offer's rate via Hotelbeds CheckRate immediately before
   * booking. Hotelbeds regenerates the `rateKey` here, so the returned key — not
   * the original offer's — must be used to book.
   */
  async quoteHotel(
    offer: HotelOffer,
    ctx: ProviderContext
  ): Promise<RateQuote> {
    if (!offer.rateKey) {
      throw new ProviderError(
        "hotelbeds",
        "validation",
        "No rateKey on offer",
        false
      );
    }

    const json = await this.hotelbedsCall<HbCheckRateResponse>(
      "/hotel-api/1.0/checkrates",
      { method: "POST", body: { rooms: [{ rateKey: offer.rateKey }] } },
      ctx
    );

    const rate = json.hotel?.rooms?.[0]?.rates?.[0];
    if (!rate || !rate.rateKey) {
      throw new ProviderError(
        "hotelbeds",
        "rate_expired",
        "Rate no longer available",
        false
      );
    }

    const priceTotal = parseFloat(rate.net ?? "0");

    return {
      // Hotelbeds regenerates the rateKey on CheckRate — use the fresh one.
      quoteId: rate.rateKey,
      providerId: "hotelbeds",
      vertical: "hotels",
      priceTotal,
      // CheckRate doesn't echo currency; carry it from the originating offer.
      currency: offer.currency,
      refundable: rate.rateClass !== "NRF",
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
      priceChanged: priceTotal !== offer.priceTotal,
      cancellationDeadline: cancellationDeadline(rate),
    };
  }

  async bookHotel(
    req: HotelBookingRequest,
    ctx: ProviderContext
  ): Promise<BookingResult> {
    const { offer } = req;
    // Prefer a re-validated quote when present; fall back to the offer's rate.
    const rateKey = req.quoteId ?? offer.rateKey;
    if (!rateKey) {
      throw new ProviderError(
        "hotelbeds",
        "validation",
        "No rateKey or quoteId to book",
        false
      );
    }

    // The lead guest is the booking holder; everyone is sent as a room pax.
    const lead = req.guests.find((g) => g.lead) ?? req.guests[0];
    if (!lead) {
      throw new ProviderError(
        "hotelbeds",
        "validation",
        "At least one guest is required to book",
        false
      );
    }

    const clientReference =
      req.agencyReference ??
      `ATLAS-${req.idempotencyKey.slice(0, 8).toUpperCase()}`;

    const json = await this.hotelbedsCall<HbBookingResponse>(
      "/hotel-api/1.0/bookings",
      {
        method: "POST",
        body: {
          holder: { name: lead.givenName, surname: lead.familyName },
          rooms: [
            {
              rateKey,
              paxes: req.guests.map((g) => ({
                roomId: 1,
                type: "AD",
                name: g.givenName,
                surname: g.familyName,
              })),
            },
          ],
          clientReference,
        },
      },
      ctx
    );

    const booking = json.booking;
    if (!booking?.reference) {
      throw new ProviderError(
        "hotelbeds",
        "unknown",
        "No reference in response",
        false
      );
    }

    return {
      ref: {
        providerId: "hotelbeds",
        confirmationNumber: booking.reference,
        raw: booking,
      },
      status: "confirmed",
      priceTotal: parseFloat(booking.totalNet ?? offer.priceTotal.toString()),
      currency: offer.currency,
    };
  }

  async cancel(
    ref: ProviderBookingRef,
    ctx: ProviderContext
  ): Promise<CancelResult> {
    let json: HbCancelResponse;
    try {
      json = await this.hotelbedsCall<HbCancelResponse>(
        `/hotel-api/1.0/bookings/${ref.confirmationNumber}`,
        { method: "DELETE" },
        ctx
      );
    } catch (error) {
      // A 404 surfaces as "unknown" from the HTTP helper; re-map it to a clear
      // "booking not found" message while keeping the code stable for callers.
      if (
        error instanceof ProviderError &&
        error.code === "unknown" &&
        /\(404\)/.test(error.message)
      ) {
        throw new ProviderError(
          "hotelbeds",
          "unknown",
          "Booking not found",
          false,
          error
        );
      }
      throw error;
    }

    const penalty = json.booking?.cancellationAmount
      ? parseFloat(json.booking.cancellationAmount)
      : undefined;

    return {
      cancelled: true,
      // Only report a penalty when one was actually charged.
      ...(penalty && penalty > 0 ? { penaltyAmount: penalty } : {}),
      // We don't have the booking's currency at cancel time — leave undefined.
    };
  }

  // --- ContentCapable -------------------------------------------------------

  /**
   * Free-text hotel name search backed by the Hotelbeds Content API (with live
   * availability when possible). `ContentCapable` only passes the query string,
   * but the underlying `searchHotelbedsHotelsByName` needs a stay window and
   * occupancy to price results — synthesize a sensible default window (a single
   * night ~30 days out, 2 adults) and carry the locale's currency from `ctx`.
   */
  async searchHotelsByName(
    query: string,
    ctx: ProviderContext
  ): Promise<HotelOffer[]> {
    const { checkIn, checkOut } = defaultStayWindow();
    const params: HotelSearchParams & { hotelName: string } = {
      hotelName: query,
      city: "",
      checkIn,
      checkOut,
      adults: DEFAULT_ADULTS,
      ...(ctx.currency ? { currency: ctx.currency } : {}),
    };

    try {
      return await searchHotelbedsHotelsByName(params);
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(
        "hotelbeds",
        "unknown",
        "Hotelbeds hotel name search failed",
        false,
        error
      );
    }
  }

  /**
   * Enrichment (thumbnail + accommodation type) for a batch of hotel codes via
   * the Content API. The batch helper returns only a thumbnail and type per
   * code, so the resulting `HotelEnrichment` carries `code` plus a single-image
   * list derived from the thumbnail; richer fields stay undefined.
   */
  async fetchHotelContent(
    codes: string[],
    _ctx: ProviderContext
  ): Promise<HotelEnrichment[]> {
    let batch: Awaited<ReturnType<typeof getHotelbedsContentBatch>>;
    try {
      batch = await getHotelbedsContentBatch(codes);
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(
        "hotelbeds",
        "unknown",
        "Hotelbeds content batch fetch failed",
        false,
        error
      );
    }

    return Object.entries(batch).map(([code, enrichment]) => ({
      code,
      // The batch helper only exposes a single thumbnail — surface it as the
      // first (and only) image so callers get a uniform image list.
      ...(enrichment.thumbnail
        ? { images: [{ url: enrichment.thumbnail }] }
        : {}),
    }));
  }

  /**
   * Live room rates for a single hotel. `getHotelbedsRates` returns
   * `HotelRoomRate[]` (a room-table shape); map each to the provider-neutral
   * `HotelOffer` the `ContentCapable` contract expects.
   */
  async fetchRoomRates(
    params: HotelContentParams,
    ctx: ProviderContext
  ): Promise<HotelOffer[]> {
    const searchParams: HotelSearchParams & { hotelCode: string } = {
      hotelCode: params.hotelCode,
      city: "",
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      adults: params.adults ?? DEFAULT_ADULTS,
      ...(params.rooms !== undefined ? { rooms: params.rooms } : {}),
      ...(params.currency ?? ctx.currency
        ? { currency: params.currency ?? ctx.currency }
        : {}),
    };

    let rates: Awaited<ReturnType<typeof getHotelbedsRates>>;
    try {
      rates = await getHotelbedsRates(searchParams);
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(
        "hotelbeds",
        "unknown",
        "Hotelbeds room rate fetch failed",
        false,
        error
      );
    }

    const currency = params.currency ?? ctx.currency ?? "EUR";
    // Map each bookable room+rate onto the offer shape, keying the offer id by
    // the rate's stable id so distinct rates for the same hotel stay unique.
    return rates.map((rate) => ({
      id: `hotelbeds-rate-${rate.id}`,
      source: "hotelbeds" as const,
      name: rate.roomName,
      stars: 0,
      city: "",
      ...(rate.boardType !== undefined ? { boardType: rate.boardType } : {}),
      refundable: rate.refundable,
      pricePerNight: rate.pricePerNight,
      priceTotal: rate.priceTotal,
      nights: rate.nights,
      currency: rate.currency || currency,
      roomName: rate.roomName,
      ...(rate.roomCode !== undefined ? { roomCode: rate.roomCode } : {}),
      ...(rate.rateKey !== undefined ? { rateKey: rate.rateKey } : {}),
      hotelCode: params.hotelCode,
    }));
  }
}
