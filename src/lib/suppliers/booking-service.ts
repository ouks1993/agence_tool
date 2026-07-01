/**
 * Booking service — the orchestration layer between server actions and the
 * provider registry.
 *
 * Encapsulates the full booking lifecycle for a single line item:
 *   idempotency check → quote (price revalidation) → book → event log → supplier ref
 *
 * Design decisions:
 *  - Every call is idempotent: the same (bookingId + itemId + offerId) always
 *    produces the same confirmation number. Callers can retry safely.
 *  - Quote (price revalidation) runs before book. A price change is logged as
 *    "price_changed" so agents can see it; the booking still proceeds.
 *  - Failures are returned as { confirmed: false } — never thrown — so callers
 *    can issue a provisional reference and surface the error to the agent without
 *    crashing the booking flow.
 *  - Idempotency rows are written before the supplier call and updated after, so
 *    a serverless timeout that drops the response never silently double-books.
 *
 * This module imports the DB directly (server-only). It must not be imported
 * from client components.
 */

import { createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookingEvent, bookingIdempotency, bookingSupplierRef } from "@/lib/schema";
import {
  canBookFlights,
  canBookHotels,
  providerRegistry,
  type GuestDetails,
  type HotelBookingRequest,
  type FlightBookingRequest,
  type ProviderContext,
} from "./providers";
import type { FlightOffer, FlightPassenger, HotelOffer } from "./types";

/** Idempotency keys expire after 24 hours. Expired rows are safe to clean up. */
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Stable, deterministic idempotency key for one booking attempt. */
function deriveKey(bookingId: string, itemId: string, offerId: string): string {
  return createHash("sha256")
    .update(`${bookingId}:${itemId}:${offerId}`)
    .digest("hex");
}

/** A fresh, non-throwing provisional in-house reference. */
function provisionalRef(): string {
  return `REF-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Register (or refresh) an idempotency key as `pending` before touching the
 * supplier. Callers reach here only after ruling out a live success/pending row,
 * so any PK conflict is an EXPIRED row: reset it to `pending` with a fresh TTL
 * (clearing the stale supplierRef) so the expired key is treated as absent for
 * this new attempt. Errors are swallowed — a failed bookkeeping write must never
 * crash the booking flow.
 */
async function registerPending(
  key: string,
  row: { bookingId: string; bookingItemId: string; providerId: string }
): Promise<void> {
  const pending = {
    status: "pending" as const,
    supplierRef: null,
    expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
  };
  try {
    await db
      .insert(bookingIdempotency)
      .values({ key, ...row, ...pending })
      .onConflictDoUpdate({
        target: bookingIdempotency.key,
        set: { providerId: row.providerId, ...pending },
      });
  } catch (err) {
    console.error("[booking-service] bookingIdempotency insert failed:", err);
  }
}

/**
 * Append one row to booking_event. Failures are swallowed with a console error
 * so a broken event write never crashes the booking flow itself.
 */
async function emitEvent(
  bookingId: string,
  agencyId: string,
  event: string,
  opts: {
    providerId?: string | undefined;
    correlationId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
  } = {}
): Promise<void> {
  try {
    await db.insert(bookingEvent).values({
      bookingId,
      agencyId,
      event,
      ...(opts.providerId ? { providerId: opts.providerId } : {}),
      ...(opts.correlationId ? { correlationId: opts.correlationId } : {}),
      ...(opts.metadata ? { metadata: opts.metadata } : {}),
    });
  } catch (err) {
    console.error(`[booking-service] booking_event insert failed (${event}):`, err);
  }
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ServiceBookingResult =
  | { confirmed: true; confirmationNumber: string; providerId: string }
  | { confirmed: false; confirmationNumber: string; reason: string };

export type FlightBookingParams = {
  bookingId: string;
  bookingItemId: string;
  agencyId: string;
  /** Human-readable agency reference (e.g. "BKG-1001") for cross-linking. */
  agencyReference: string;
  offer: FlightOffer;
  passengers: FlightPassenger[];
  ctx: ProviderContext;
};

export type HotelBookingParams = {
  bookingId: string;
  bookingItemId: string;
  agencyId: string;
  agencyReference: string;
  offer: HotelOffer;
  guests: GuestDetails[];
  ctx: ProviderContext;
};

// ---------------------------------------------------------------------------
// serviceBookFlight
// ---------------------------------------------------------------------------

/**
 * Book a flight item via the provider registry.
 *
 * Idempotent: replaying the same (bookingId, bookingItemId, offer) returns the
 * cached confirmation without calling the supplier again. On provider failure
 * returns { confirmed: false } with a provisional `REF-…` reference — never throws.
 */
export async function serviceBookFlight(
  params: FlightBookingParams
): Promise<ServiceBookingResult> {
  const { bookingId, bookingItemId, agencyId, offer, passengers, ctx } = params;

  // --- Guard: an item with no usable offer can't be booked with a supplier. --
  // Proposal-converted items carry no `details`, so `offer` is null here. Fall
  // back to a provisional reference rather than crashing on `offer.rawOfferId`.
  const offerId = offer?.rawOfferId ?? offer?.id;
  if (!offerId) {
    return {
      confirmed: false,
      confirmationNumber: provisionalRef(),
      reason: "No supplier offer attached to this item",
    };
  }
  const idempotencyKey = deriveKey(bookingId, bookingItemId, offerId);

  // --- Replay: return the cached result when a prior attempt succeeded and the
  // key has not expired. A `pending` row means a prior invocation touched the
  // supplier and never recorded a result (e.g. serverless timeout) — treat it
  // as in-flight and DO NOT re-call the provider, to avoid a double PNR/charge.
  const existing = await db.query.bookingIdempotency.findFirst({
    where: and(
      eq(bookingIdempotency.key, idempotencyKey),
      gt(bookingIdempotency.expiresAt, new Date())
    ),
  });
  if (existing?.status === "success" && existing.supplierRef) {
    return {
      confirmed: true,
      confirmationNumber: existing.supplierRef,
      providerId: existing.providerId,
    };
  }
  if (existing?.status === "pending") {
    return {
      confirmed: false,
      confirmationNumber: provisionalRef(),
      reason:
        "A prior booking attempt is still in flight — reconcile with the supplier before retrying",
    };
  }

  // --- Resolve provider. ----------------------------------------------------
  const provider = providerRegistry.pick("flights", "book");
  if (!provider || !canBookFlights(provider)) {
    return {
      confirmed: false,
      confirmationNumber: provisionalRef(),
      reason: "No configured flight booking provider",
    };
  }

  // --- Register idempotency key as pending before touching the supplier. ----
  // An existing row can only be an EXPIRED one here (a live success/pending row
  // short-circuited above), so on PK conflict we refresh it back to pending with
  // a new TTL rather than skipping — an expired key is treated as absent.
  await registerPending(idempotencyKey, {
    bookingId,
    bookingItemId,
    providerId: provider.id,
  });

  // --- Quote (price revalidation). -----------------------------------------
  // A failed quote is non-fatal: we proceed to book and let the supplier
  // reject the stale rate explicitly (which surfaces as a ProviderError).
  let priceChanged = false;
  try {
    const quote = await provider.quoteFlight(offer, ctx);
    priceChanged = quote.priceChanged ?? false;
    await emitEvent(
      bookingId,
      agencyId,
      priceChanged ? "price_changed" : "price_validated",
      {
        providerId: provider.id,
        correlationId: ctx.correlationId,
        metadata: { priceTotal: quote.priceTotal, currency: quote.currency },
      }
    );
  } catch (err) {
    console.error("[booking-service] quoteFlight failed, proceeding to book:", err);
    await emitEvent(bookingId, agencyId, "price_validated", {
      providerId: provider.id,
      correlationId: ctx.correlationId,
      metadata: { warning: "quote step failed, proceeding directly to book" },
    });
  }

  // --- Book. ----------------------------------------------------------------
  await emitEvent(bookingId, agencyId, "booking_submitted", {
    providerId: provider.id,
    correlationId: ctx.correlationId,
    metadata: { offerId, priceChanged },
  });

  const req: FlightBookingRequest = {
    offer,
    passengers,
    idempotencyKey,
    agencyReference: params.agencyReference,
  };

  try {
    const result = await provider.bookFlight(req, ctx);

    // Persist the structured supplier reference.
    await db.insert(bookingSupplierRef).values({
      bookingId,
      bookingItemId,
      providerId: provider.id,
      confirmationNumber: result.ref.confirmationNumber,
      ...(result.ref.raw ? { rawPayload: result.ref.raw as Record<string, unknown> } : {}),
    });

    // Mark idempotency key as succeeded.
    await db
      .update(bookingIdempotency)
      .set({ status: "success", supplierRef: result.ref.confirmationNumber })
      .where(eq(bookingIdempotency.key, idempotencyKey));

    await emitEvent(bookingId, agencyId, "booking_confirmed", {
      providerId: provider.id,
      correlationId: ctx.correlationId,
      metadata: {
        confirmationNumber: result.ref.confirmationNumber,
        status: result.status,
        priceTotal: result.priceTotal,
        currency: result.currency,
      },
    });

    return {
      confirmed: true,
      confirmationNumber: result.ref.confirmationNumber,
      providerId: provider.id,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("[booking-service] bookFlight failed:", err);

    await db
      .update(bookingIdempotency)
      .set({ status: "failed" })
      .where(eq(bookingIdempotency.key, idempotencyKey));

    await emitEvent(bookingId, agencyId, "booking_failed", {
      providerId: provider.id,
      correlationId: ctx.correlationId,
      metadata: { reason },
    });

    return {
      confirmed: false,
      confirmationNumber: provisionalRef(),
      reason,
    };
  }
}

// ---------------------------------------------------------------------------
// serviceBookHotel
// ---------------------------------------------------------------------------

/**
 * Book a hotel item via the provider registry.
 *
 * The quote (CheckRate) step re-prices the rate immediately before booking and
 * returns a fresh `rateKey`. The refreshed key is passed as `quoteId` to the
 * book call so the provider always uses the latest confirmed rate.
 */
export async function serviceBookHotel(
  params: HotelBookingParams
): Promise<ServiceBookingResult> {
  const { bookingId, bookingItemId, agencyId, offer, guests, ctx } = params;

  // --- Guard: an item with no usable offer can't be booked with a supplier. --
  // Proposal-converted items carry no `details`, so `offer` is null here. Fall
  // back to a provisional reference rather than crashing on `offer.rateKey`.
  const offerId = offer?.rateKey ?? offer?.id;
  if (!offerId) {
    return {
      confirmed: false,
      confirmationNumber: provisionalRef(),
      reason: "No supplier offer attached to this item",
    };
  }
  const idempotencyKey = deriveKey(bookingId, bookingItemId, offerId);

  // --- Replay: cached success (unexpired) short-circuits; an in-flight
  // `pending` row is NOT re-called (avoids a double reservation/charge). ------
  const existing = await db.query.bookingIdempotency.findFirst({
    where: and(
      eq(bookingIdempotency.key, idempotencyKey),
      gt(bookingIdempotency.expiresAt, new Date())
    ),
  });
  if (existing?.status === "success" && existing.supplierRef) {
    return {
      confirmed: true,
      confirmationNumber: existing.supplierRef,
      providerId: existing.providerId,
    };
  }
  if (existing?.status === "pending") {
    return {
      confirmed: false,
      confirmationNumber: provisionalRef(),
      reason:
        "A prior booking attempt is still in flight — reconcile with the supplier before retrying",
    };
  }

  // --- Resolve provider. ----------------------------------------------------
  const provider = providerRegistry.pick("hotels", "book");
  if (!provider || !canBookHotels(provider)) {
    return {
      confirmed: false,
      confirmationNumber: provisionalRef(),
      reason: "No configured hotel booking provider",
    };
  }

  // --- Register idempotency key (refreshing an expired row). ----------------
  await registerPending(idempotencyKey, {
    bookingId,
    bookingItemId,
    providerId: provider.id,
  });

  // --- Quote (CheckRate re-price). -----------------------------------------
  let priceChanged = false;
  let quotedRateKey: string | undefined;
  try {
    const quote = await provider.quoteHotel(offer, ctx);
    priceChanged = quote.priceChanged ?? false;
    quotedRateKey = quote.quoteId;
    await emitEvent(
      bookingId,
      agencyId,
      priceChanged ? "price_changed" : "price_validated",
      {
        providerId: provider.id,
        correlationId: ctx.correlationId,
        metadata: { priceTotal: quote.priceTotal, currency: quote.currency },
      }
    );
  } catch (err) {
    console.error("[booking-service] quoteHotel failed, proceeding to book:", err);
    await emitEvent(bookingId, agencyId, "price_validated", {
      providerId: provider.id,
      correlationId: ctx.correlationId,
      metadata: { warning: "quote step failed, proceeding directly to book" },
    });
  }

  // --- Book. ----------------------------------------------------------------
  await emitEvent(bookingId, agencyId, "booking_submitted", {
    providerId: provider.id,
    correlationId: ctx.correlationId,
    metadata: { offerId, priceChanged },
  });

  const req: HotelBookingRequest = {
    offer,
    guests,
    idempotencyKey,
    agencyReference: params.agencyReference,
    ...(quotedRateKey ? { quoteId: quotedRateKey } : {}),
  };

  try {
    const result = await provider.bookHotel(req, ctx);

    await db.insert(bookingSupplierRef).values({
      bookingId,
      bookingItemId,
      providerId: provider.id,
      confirmationNumber: result.ref.confirmationNumber,
      ...(result.ref.raw ? { rawPayload: result.ref.raw as Record<string, unknown> } : {}),
    });

    await db
      .update(bookingIdempotency)
      .set({ status: "success", supplierRef: result.ref.confirmationNumber })
      .where(eq(bookingIdempotency.key, idempotencyKey));

    await emitEvent(bookingId, agencyId, "booking_confirmed", {
      providerId: provider.id,
      correlationId: ctx.correlationId,
      metadata: {
        confirmationNumber: result.ref.confirmationNumber,
        status: result.status,
        priceTotal: result.priceTotal,
        currency: result.currency,
      },
    });

    return {
      confirmed: true,
      confirmationNumber: result.ref.confirmationNumber,
      providerId: provider.id,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("[booking-service] bookHotel failed:", err);

    await db
      .update(bookingIdempotency)
      .set({ status: "failed" })
      .where(eq(bookingIdempotency.key, idempotencyKey));

    await emitEvent(bookingId, agencyId, "booking_failed", {
      providerId: provider.id,
      correlationId: ctx.correlationId,
      metadata: { reason },
    });

    return {
      confirmed: false,
      confirmationNumber: provisionalRef(),
      reason,
    };
  }
}
