/**
 * Duffel flight provider implemented against the capability-segmented
 * `BookingProvider` contract (./types.ts).
 *
 * Mirrors the live logic in ../duffel.ts but plugs into the registry abstraction:
 * search → quote (revalidate price) → book (idempotent) → cancel, with all
 * failures normalized to `ProviderError` so callers branch on `code`, not strings.
 *
 * Credentials come exclusively from getFlightProviderConfig() — this file never
 * reads process.env directly.
 *
 * Docs: https://duffel.com/docs/api
 */

import { getFlightProviderConfig } from "../config";
import {
  ProviderError,
  type BookingResult,
  type CancelCapable,
  type CancelResult,
  type FlightBookingCapable,
  type FlightBookingRequest,
  type FlightSearchCapable,
  type ProviderBookingRef,
  type ProviderContext,
  type ProviderDescriptor,
  type RateQuote,
} from "./types";
import type {
  CabinClass,
  FlightOffer,
  FlightSearchParams,
  FlightSegment,
} from "../types";

const API = "https://api.duffel.com";

/** Hard cap on any upstream Duffel call when the caller doesn't supply a signal,
 * so a hung provider can't pin a request to Vercel's 30s function ceiling. */
const FETCH_TIMEOUT_MS = 15000;

/** Quotes are time-boxed locally: Duffel offers are short-lived (~minutes). */
const QUOTE_TTL_MS = 10 * 60 * 1000;

const CABIN_TO_DUFFEL: Record<CabinClass, string> = {
  economy: "economy",
  premium: "premium_economy",
  business: "business",
  first: "first",
};

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

function minutesBetween(a: string, b: string): number {
  return Math.max(
    0,
    Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)
  );
}

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
type SingleOfferResponse = { data?: DfOffer };
type DfOrder = {
  id: string;
  booking_reference: string;
  total_amount?: string;
  total_currency?: string;
};
type OrderResponse = { data?: DfOrder };

/**
 * Single Duffel HTTP entry point. Reads credentials from the resolved provider
 * config, honours the caller's abort signal (falling back to a local timeout),
 * and maps every failure mode to a `ProviderError` with a stable code.
 *
 * Not exported: the provider is the only legitimate caller.
 */
async function duffelFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown; headers?: Record<string, string> },
  ctx?: ProviderContext
): Promise<T> {
  const config = getFlightProviderConfig();
  if (config.provider !== "duffel") {
    throw new ProviderError(
      "duffel",
      "auth",
      "Duffel is not configured",
      false
    );
  }

  // Use the caller's signal when present; otherwise enforce a local timeout so a
  // hung upstream can't outlive the serverless function.
  let controller: AbortController | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let signal = ctx?.signal;
  if (!signal) {
    controller = new AbortController();
    timeout = setTimeout(() => controller!.abort(), FETCH_TIMEOUT_MS);
    signal = controller.signal;
  }

  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Duffel-Version": config.version,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init?.headers,
      },
      signal,
      ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError(
        "duffel",
        "provider_unavailable",
        `Duffel ${path} aborted or timed out`,
        true,
        error
      );
    }
    throw new ProviderError(
      "duffel",
      "provider_unavailable",
      `Duffel ${path} request failed`,
      true,
      error
    );
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw httpError(path, res.status, text);
  }

  return (await res.json()) as T;
}

/** Map an HTTP status to the normalized error code. */
function httpError(path: string, status: number, body: string): ProviderError {
  const detail = body.slice(0, 200);
  if (status === 401 || status === 403) {
    return new ProviderError(
      "duffel",
      "auth",
      `Duffel ${path} unauthorized (${status}): ${detail}`,
      false
    );
  }
  if (status === 429) {
    return new ProviderError(
      "duffel",
      "rate_limited",
      `Duffel ${path} rate limited (${status}): ${detail}`,
      true
    );
  }
  if (status === 422) {
    // Duffel returns 422 when an offer has expired or is otherwise no longer bookable.
    return new ProviderError(
      "duffel",
      "rate_expired",
      `Duffel ${path} offer expired (${status}): ${detail}`,
      false
    );
  }
  return new ProviderError(
    "duffel",
    "unknown",
    `Duffel ${path} failed (${status}): ${detail}`,
    false
  );
}

/** Strip the internal `duffel-fl-` prefix to recover the raw provider offer id. */
function resolveRawOfferId(offer: FlightOffer): string {
  return offer.rawOfferId ?? offer.id.replace("duffel-fl-", "");
}

export class DuffelBookingProvider
  implements
    ProviderDescriptor,
    FlightSearchCapable,
    FlightBookingCapable,
    CancelCapable
{
  readonly id = "duffel" as const;
  readonly label = "Duffel";
  readonly verticals = ["flights"] as const;
  readonly capabilities = ["search", "quote", "book", "cancel"] as const;
  readonly priority = 50;

  isConfigured(): boolean {
    return getFlightProviderConfig().provider === "duffel";
  }

  async searchFlights(
    params: FlightSearchParams,
    ctx: ProviderContext
  ): Promise<FlightOffer[]> {
    const slices: Array<{
      origin: string;
      destination: string;
      departure_date: string;
    }> = [
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

    const json = await duffelFetch<OfferRequestResponse>(
      "/air/offer_requests?return_offers=true&supplier_timeout=15000",
      { method: "POST", body },
      ctx
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
      const code =
        offer.owner?.iata_code ?? firstSeg?.marketing_carrier.iata_code ?? "";
      const name = offer.owner?.name ?? firstSeg?.marketing_carrier.name ?? code;
      return [
        {
          id: `duffel-fl-${offer.id}`,
          rawOfferId: offer.id,
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

  async quoteFlight(
    offer: FlightOffer,
    ctx: ProviderContext
  ): Promise<RateQuote> {
    const rawOfferId = resolveRawOfferId(offer);

    let json: SingleOfferResponse;
    try {
      json = await duffelFetch<SingleOfferResponse>(
        `/air/offers/${rawOfferId}`,
        undefined,
        ctx
      );
    } catch (error) {
      // A 404 surfaces as "unknown" from httpError; treat both 404 and 422 as an
      // expired/gone offer so the caller re-searches rather than retrying blindly.
      if (
        error instanceof ProviderError &&
        (error.code === "rate_expired" || error.code === "unknown")
      ) {
        throw new ProviderError(
          "duffel",
          "rate_expired",
          `Duffel offer ${rawOfferId} is no longer available`,
          false,
          error
        );
      }
      throw error;
    }

    const refreshed = json.data;
    if (!refreshed) {
      throw new ProviderError(
        "duffel",
        "rate_expired",
        `Duffel offer ${rawOfferId} is no longer available`,
        false
      );
    }

    const priceTotal = parseFloat(refreshed.total_amount);
    return {
      quoteId: offer.id,
      providerId: "duffel",
      vertical: "flights",
      priceTotal,
      currency: refreshed.total_currency,
      refundable: true,
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
      priceChanged: priceTotal !== offer.priceTotal,
    };
  }

  async bookFlight(
    req: FlightBookingRequest,
    ctx: ProviderContext
  ): Promise<BookingResult> {
    const { offer, passengers } = req;
    const rawOfferId = resolveRawOfferId(offer);

    const body = {
      data: {
        type: "instant",
        selected_offers: [rawOfferId],
        passengers: passengers.map((p) => ({
          type: p.type,
          given_name: p.given_name,
          family_name: p.family_name,
          born_on: p.born_on,
          gender: p.gender,
          ...(p.identity_documents
            ? { identity_documents: p.identity_documents }
            : {}),
        })),
        payments: [
          {
            type: "balance",
            amount: offer.priceTotal.toFixed(2),
            currency: offer.currency,
          },
        ],
      },
    };

    const json = await duffelFetch<OrderResponse>(
      "/air/orders",
      {
        method: "POST",
        body,
        headers: { "Idempotency-Key": req.idempotencyKey },
      },
      ctx
    );

    const order = json.data;
    if (!order?.booking_reference) {
      throw new ProviderError(
        "duffel",
        "unknown",
        "Duffel order missing booking_reference",
        false
      );
    }

    return {
      ref: {
        providerId: "duffel",
        confirmationNumber: order.booking_reference,
        raw: order,
      },
      status: "confirmed",
      priceTotal: order.total_amount
        ? parseFloat(order.total_amount)
        : offer.priceTotal,
      currency: order.total_currency ?? offer.currency,
    };
  }

  async cancel(
    ref: ProviderBookingRef,
    ctx: ProviderContext
  ): Promise<CancelResult> {
    try {
      await duffelFetch<unknown>(
        `/air/orders/${ref.confirmationNumber}`,
        { method: "DELETE" },
        ctx
      );
    } catch (error) {
      if (error instanceof ProviderError && error.code === "unknown") {
        // httpError maps an unmatched status (incl. 404) to "unknown"; re-message
        // the not-found case so the caller has a clear signal.
        throw new ProviderError(
          "duffel",
          "unknown",
          `Order ${ref.confirmationNumber} not found`,
          false,
          error
        );
      }
      throw error;
    }

    return { cancelled: true };
  }
}
