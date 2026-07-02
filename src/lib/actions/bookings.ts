"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { autoGenerateCommissions } from "@/lib/actions/commissions";
import type { ActionResult } from "@/lib/actions/types";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import {
  type BookingStatus,
  canDeleteRecords,
  GENDERS,
  nextBookingStatus,
  TITLES,
  TRAVEL_PURPOSES,
  TRIP_TYPES,
} from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import {
  depositAmount,
  effectiveDepositPercent,
  meetsDepositThreshold,
} from "@/lib/payments/deposit";
import { paymentSummary } from "@/lib/payments/summary";
import { requireAgencyUser } from "@/lib/permissions";
import { agency, booking, bookingTraveller, bookingItem, bookingDay, client, product, payment } from "@/lib/schema";
import {
  type FlightOffer,
  type FlightPassenger,
  type HotelOffer,
} from "@/lib/suppliers";
import { serviceBookFlight, serviceBookHotel } from "@/lib/suppliers/booking-service";
import { type GuestDetails, type ProviderContext } from "@/lib/suppliers/providers";

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Finite-guarded numeric coercion (same semantics as `num` in analytics.ts):
 * a malformed/`NaN` amount coerces to 0 so it can never poison a persisted
 * total with the string "NaN".
 */
function num(v: string | number | null | undefined): number {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  return Number.isFinite(n) ? (n as number) : 0;
}

/** True when a DB error is a Postgres unique-constraint violation (code 23505). */
function isUniqueViolation(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  const causeCode = (e as { cause?: { code?: string } })?.cause?.code;
  return code === "23505" || causeCode === "23505";
}

/**
 * Next per-agency booking reference. Derived from the highest existing
 * reference number (NOT the row count) so deleting a booking can never produce
 * a colliding reference. Callers retry on the rare concurrent-insert collision.
 */
async function nextReference(agencyId: string): Promise<string> {
  const rows = await db
    .select({ reference: booking.reference })
    .from(booking)
    .where(eq(booking.agencyId, agencyId));
  let max = 1000;
  for (const r of rows) {
    const n = Number.parseInt(r.reference.replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `BKG-${max + 1}`;
}

/**
 * Recompute and persist a booking's total from its line items. Scoped to the
 * caller's agency: items are summed only when their parent booking belongs to
 * `agencyId`, and the total is written only to that agency's booking. Callers
 * must pass the already-validated `agencyId` so this can never be triggered with
 * an attacker-controlled `bookingId` from another tenant.
 */
async function recalcTotal(
  bookingId: string,
  agencyId: string
): Promise<void> {
  const items = await db
    .select({ amount: bookingItem.amount, quantity: bookingItem.quantity })
    .from(bookingItem)
    .innerJoin(booking, eq(bookingItem.bookingId, booking.id))
    .where(
      and(eq(bookingItem.bookingId, bookingId), eq(booking.agencyId, agencyId))
    );
  const total = items.reduce(
    (s, i) => s + num(i.amount) * i.quantity,
    0
  );
  await db
    .update(booking)
    .set({ totalAmount: String(round2(total)) })
    .where(and(eq(booking.id, bookingId), eq(booking.agencyId, agencyId)));
}

/**
 * Payment position for a booking (`paid` = completed payments minus refunds,
 * `balance` = total − paid). Used to hard-gate status transitions: the deposit
 * threshold for `confirmed` and the zero-balance rule for `ticketed`/`completed`.
 */
async function bookingPayment(
  bookingId: string,
  totalAmount: string | null
): Promise<{ paid: number; balance: number }> {
  const payments = await db
    .select({
      amount: payment.amount,
      kind: payment.kind,
      status: payment.status,
    })
    .from(payment)
    .where(eq(payment.bookingId, bookingId));
  return paymentSummary(payments, parseFloat(totalAmount || "0"));
}

/**
 * The effective deposit percentage for a booking — the share of the total that
 * must be paid to confirm. Resolves the override chain
 * `booking.depositPercent ?? agency.depositPercent`, using the booking's own
 * snapshotted override (frozen at conversion) when present and otherwise the
 * agency default. Scoped to the booking's own `agencyId` (tenant-safe — the
 * booking row is caller-validated before this runs). Falls back to 50% — the
 * historical default — if the override is null and the agency row is missing.
 */
async function bookingDepositPercent(b: {
  agencyId: string;
  depositPercent: string | null;
}): Promise<number> {
  const row = await db.query.agency.findFirst({
    where: eq(agency.id, b.agencyId),
    columns: { depositPercent: true },
  });
  return effectiveDepositPercent(b.depositPercent, row?.depositPercent);
}

// --- Booking CRUD -----------------------------------------------------------

const bookingInput = z.object({
  clientId: z.string().optional(),
  destination: z.string().trim().max(200).optional(),
  departDate: z.string().optional(),
  returnDate: z.string().optional(),
  travelPurpose: z.enum(TRAVEL_PURPOSES).optional().or(z.literal("")),
  tripType: z.enum(TRIP_TYPES).optional().or(z.literal("")),
  currency: z.string().trim().min(1).max(8).default("DZD"),
  notes: z.string().trim().max(5000).optional(),
  leadTravellerName: z.string().trim().max(200).optional(),
  // Optional per-deal deposit override. `null` means "inherit" — the effective
  // % resolves along booking.depositPercent ?? agency.depositPercent. `0` is a
  // meaningful value (no deposit), so the edit form maps an empty field to null.
  // Only `updateBooking` reads this; `createBooking` leaves the column NULL.
  depositPercent: z.coerce.number().min(0).max(100).nullable().optional(),
});

export type BookingInput = z.input<typeof bookingInput>;

export async function createBooking(
  input: BookingInput
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAgencyUser();
  const parsed = bookingInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;

  // Validate the client belongs to this agency before linking it.
  if (d.clientId) {
    const c = await db.query.client.findFirst({
      where: and(eq(client.id, d.clientId), eq(client.agencyId, user.agencyId)),
    });
    if (!c) return { ok: false, error: "Client not found" };
  }

  // Generate a reference and insert, retrying on the rare reference collision
  // (two bookings created at the same instant resolving the same max+1).
  let reference = "";
  let row: { id: string } | undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    reference = await nextReference(user.agencyId);
    try {
      [row] = await db
        .insert(booking)
        .values({
          agencyId: user.agencyId,
          reference,
          clientId: d.clientId || null,
          destination: d.destination || null,
          departDate: toDate(d.departDate),
          returnDate: toDate(d.returnDate),
          travelPurpose: d.travelPurpose || null,
          tripType: d.tripType || null,
          currency: d.currency,
          notes: d.notes || null,
          createdById: user.id,
        })
        .returning({ id: booking.id });
      break;
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 4) continue;
      throw e;
    }
  }

  if (!row) return { ok: false, error: "Failed to create booking" };

  if (d.leadTravellerName) {
    await db.insert(bookingTraveller).values({
      bookingId: row.id,
      fullName: d.leadTravellerName,
      isLead: true,
      sortOrder: 0,
    });
  }

  await logActivity({
    agencyId: user.agencyId,
    userId: user.id,
    action: "created",
    entityType: "booking",
    entityId: row.id,
    entityLabel: `${reference}${d.destination ? ` · ${d.destination}` : ""}`,
  });

  revalidatePath("/bookings");
  return { ok: true, data: { id: row.id } };
}

export async function updateBooking(
  id: string,
  input: BookingInput
): Promise<ActionResult> {
  const user = await requireAgencyUser();
  const parsed = bookingInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;
  const existing = await db.query.booking.findFirst({
    where: and(eq(booking.id, id), eq(booking.agencyId, user.agencyId)),
  });
  if (!existing) return { ok: false, error: "Booking not found" };

  // Validate the client belongs to this agency before linking it.
  if (d.clientId) {
    const c = await db.query.client.findFirst({
      where: and(eq(client.id, d.clientId), eq(client.agencyId, user.agencyId)),
    });
    if (!c) return { ok: false, error: "Client not found" };
  }

  await db
    .update(booking)
    .set({
      clientId: d.clientId || null,
      destination: d.destination || null,
      departDate: toDate(d.departDate),
      returnDate: toDate(d.returnDate),
      travelPurpose: d.travelPurpose || null,
      tripType: d.tripType || null,
      currency: d.currency,
      notes: d.notes || null,
      // Empty field → null (inherit the agency default); an explicit 0..100
      // override is stored as a numeric string. The edit form always sends this
      // field, so writing it here can't accidentally clear a value elsewhere.
      depositPercent:
        d.depositPercent == null ? null : String(d.depositPercent),
    })
    .where(and(eq(booking.id, id), eq(booking.agencyId, user.agencyId)));

  await logActivity({
    agencyId: user.agencyId,
    userId: user.id,
    action: "updated",
    entityType: "booking",
    entityId: id,
    entityLabel: existing.reference,
  });

  revalidatePath("/bookings");
  revalidatePath(`/bookings/${id}`);
  return { ok: true };
}

/**
 * A booking row loaded with its items — the shape the lifecycle guards operate
 * on. Both `setBookingStatus` and `advanceStatus` pass their loaded row here.
 */
type BookingWithItems = typeof booking.$inferSelect & {
  items: (typeof bookingItem.$inferSelect)[];
};

/** Forward lifecycle steps that require the booking to have at least one item. */
const ITEMS_REQUIRED_STATUSES: BookingStatus[] = [
  "confirmed",
  "ticketed",
  "completed",
];

/** Forward steps that require the outstanding balance to be fully settled. */
const ZERO_BALANCE_STATUSES: BookingStatus[] = ["ticketed", "completed"];

/**
 * Enforce the per-target lifecycle prerequisites shared by `setBookingStatus`
 * and `advanceStatus`. Returns an error `ActionResult` to short-circuit on, or
 * `null` when the transition to `target` is permitted so far.
 *
 * Agent-side only: both callers first run `requireAgencyUser`, and the public
 * proposal→booking path creates bookings in `awaiting_payment` without ever
 * touching this helper. Deriving the deposit % from `existing.agencyId` is
 * therefore tenant-safe.
 *
 * - `cancelled` and backward moves (e.g. → draft) are always permitted (no
 *   prerequisites): a booking must be cancellable/reversible from any state.
 * - `confirmed`/`ticketed`/`completed` all require at least one trip service.
 * - `confirmed` additionally requires the booking's **effective deposit
 *   threshold** to be met (paid ≥ depositPercent of the total), resolving the
 *   chain booking.depositPercent (snapshotted at conversion) ?? agency default —
 *   this is what the client proposal promises "secures the dates". A 100%
 *   deposit collapses to zero-balance.
 * - `ticketed`/`completed` additionally require a **fully settled balance**
 *   (>0.01 tolerates float drift) — the zero-balance gate that formerly sat on
 *   `confirmed` now blocks ticketing (and stays on completion).
 */
async function checkStatusPrerequisites(
  existing: BookingWithItems,
  target: BookingStatus
): Promise<{ ok: false; error: string } | null> {
  if (
    !ITEMS_REQUIRED_STATUSES.includes(target) &&
    !ZERO_BALANCE_STATUSES.includes(target)
  ) {
    return null;
  }

  if (existing.items.length === 0) {
    return { ok: false, error: "Add at least one trip service before confirming." };
  }

  const total = parseFloat(existing.totalAmount || "0");
  const { paid, balance } = await bookingPayment(existing.id, existing.totalAmount);

  // Deposit gate — reaching `confirmed` unlocks at the booking's effective
  // deposit threshold (its snapshotted override, else the agency default).
  if (target === "confirmed") {
    const percent = await bookingDepositPercent(existing);
    if (!meetsDepositThreshold(total, paid, percent)) {
      const required = depositAmount(total, percent);
      return {
        ok: false,
        error:
          `Requires the ${percent}% deposit (${formatMoney(required, existing.currency)}) — ` +
          `${formatMoney(paid, existing.currency)} received so far.`,
      };
    }
  }

  // Zero-balance gate — ticketing and completion require full payment.
  if (ZERO_BALANCE_STATUSES.includes(target) && balance > 0.01) {
    return {
      ok: false,
      error: `Balance of ${formatMoney(balance, existing.currency)} is still due.`,
    };
  }

  return null;
}

/**
 * Ticketing supplier-confirmation flow, shared by `setBookingStatus` and
 * `advanceStatus`. Ensures every item has a REAL provider confirmation before a
 * booking is ticketed. A provider failure stores its provisional reference but
 * keeps that line "pending" and returns an error result so the caller aborts —
 * a booking is never ticketed off a fabricated confirmation.
 *
 * Returns `null` on success (all items confirmed) or an error `ActionResult`.
 */
async function runTicketingConfirmation(
  existing: BookingWithItems,
  agencyId: string,
  userId: string | null
): Promise<{ ok: false; error: string } | null> {
  const passengers = await buildFlightPassengers(existing.id);
  const failures: string[] = [];
  for (const item of existing.items) {
    if (item.confirmationNumber) continue;
    const result = await confirmItemBooking(item, passengers, agencyId, existing.reference);
    await db
      .update(bookingItem)
      .set({
        confirmationNumber: result.confirmationNumber,
        itemStatus: result.confirmed ? "ticketed" : "pending",
      })
      .where(eq(bookingItem.id, item.id));
    if (!result.confirmed) {
      failures.push(`${item.title}: ${result.reason}`);
    }
  }
  if (failures.length > 0) {
    await logActivity({
      agencyId,
      userId,
      action: "updated",
      entityType: "booking",
      entityId: existing.id,
      entityLabel: existing.reference,
      metadata: { ticketingFailed: failures },
    });
    revalidatePath(`/bookings/${existing.id}`);
    return {
      ok: false,
      error: `Could not ticket every service: ${failures.join("; ")}`,
    };
  }
  return null;
}

/**
 * Set a booking to an explicit status. Unlike `advanceStatus` (which only steps
 * to the immediate next lifecycle status) this can jump to any status, so it
 * MUST enforce the same server-side guards for every forward target — the
 * dropdown offers all statuses and cannot be trusted. Backward moves and
 * `cancelled` remain reachable from any state.
 */
export async function setBookingStatus(
  id: string,
  status: BookingStatus
): Promise<ActionResult> {
  const user = await requireAgencyUser();
  const existing = await db.query.booking.findFirst({
    where: and(eq(booking.id, id), eq(booking.agencyId, user.agencyId)),
    with: { items: true },
  });
  if (!existing) return { ok: false, error: "Booking not found" };

  // Same items-required + zero-balance gates advanceStatus enforces.
  const prereq = await checkStatusPrerequisites(existing, status);
  if (prereq) return prereq;

  // Ticketing runs the same supplier-confirmation flow as advanceStatus and
  // aborts if any provider fails — no booking is ticketed off a fabricated ref.
  if (status === "ticketed") {
    const ticketing = await runTicketingConfirmation(existing, user.agencyId, user.id);
    if (ticketing) return ticketing;
  }

  await db
    .update(booking)
    .set({ status })
    .where(and(eq(booking.id, id), eq(booking.agencyId, user.agencyId)));

  // Commissions are generated when a booking first enters confirmed/ticketed.
  if (status === "confirmed" || status === "ticketed") {
    await autoGenerateCommissions(id, user.agencyId);
  }

  await logActivity({
    agencyId: user.agencyId,
    userId: user.id,
    action: "status_changed",
    entityType: "booking",
    entityId: id,
    entityLabel: existing.reference,
    metadata: { from: existing.status, to: status },
  });

  revalidatePath("/bookings");
  revalidatePath("/operations");
  revalidatePath(`/bookings/${id}`);
  return { ok: true };
}

export async function deleteBooking(id: string): Promise<ActionResult> {
  const user = await requireAgencyUser();
  const existing = await db.query.booking.findFirst({
    where: and(eq(booking.id, id), eq(booking.agencyId, user.agencyId)),
  });
  if (!existing) return { ok: false, error: "Booking not found" };
  if (!canDeleteRecords(user.role) && existing.createdById !== user.id) {
    return { ok: false, error: "You don't have permission to delete this" };
  }

  await db
    .delete(booking)
    .where(and(eq(booking.id, id), eq(booking.agencyId, user.agencyId)));

  await logActivity({
    agencyId: user.agencyId,
    userId: user.id,
    action: "deleted",
    entityType: "booking",
    entityId: id,
    entityLabel: existing.reference,
  });

  revalidatePath("/bookings");
  return { ok: true };
}

/**
 * Build the flight passenger list a live order needs from a booking's
 * travellers. Names are split on whitespace (last token = family name). Missing
 * data falls back to safe placeholders — a real order with bad data fails
 * gracefully to a provisional reference in the supplier layer.
 */
async function buildFlightPassengers(bookingId: string): Promise<FlightPassenger[]> {
  const travellers = await db.query.bookingTraveller.findMany({
    where: eq(bookingTraveller.bookingId, bookingId),
  });
  return travellers.map((t) => {
    const nameParts = t.fullName.trim().split(/\s+/);
    const family_name = nameParts.pop() ?? t.fullName;
    const given_name = nameParts.join(" ") || family_name;
    const born_on = t.dateOfBirth
      ? t.dateOfBirth.toISOString().slice(0, 10)
      : "1990-01-01"; // fallback — a real booking fails gracefully anyway
    return {
      type: "adult" as const,
      given_name,
      family_name,
      born_on,
      // Duffel sandbox accepts this; real bookings need the actual gender.
      gender: "m" as const,
      ...(t.passportNumber && t.nationality && t.passportExpiry
        ? {
            identity_documents: [
              {
                type: "passport" as const,
                unique_identifier: t.passportNumber,
                issuing_country_code: t.nationality.slice(0, 2).toUpperCase(),
                expires_on: t.passportExpiry.toISOString().slice(0, 10),
              },
            ],
          }
        : {}),
    };
  });
}

/** Build the hotel guest list from a booking's travellers (lead traveller first). */
async function buildHotelGuests(bookingId: string): Promise<GuestDetails[]> {
  const travellers = await db.query.bookingTraveller.findMany({
    where: eq(bookingTraveller.bookingId, bookingId),
  });
  if (travellers.length === 0) {
    return [{ givenName: "Guest", familyName: "Traveller", lead: true }];
  }
  const sorted = [...travellers].sort(
    (a, b) => (b.isLead ? 1 : 0) - (a.isLead ? 1 : 0) || a.sortOrder - b.sortOrder
  );
  return sorted.map((t, i) => {
    const parts = t.fullName.trim().split(/\s+/);
    const familyName = parts.pop() ?? t.fullName;
    const givenName = parts.join(" ") || familyName;
    return { givenName, familyName, ...(i === 0 ? { lead: true } : {}) };
  });
}

/**
 * Outcome of booking a single item with its supplier. `confirmed` is the
 * discriminator: it is `true` ONLY when the live provider returned a real PNR,
 * and `false` when the provider call failed (or the item type can't be booked
 * automatically) and we fell back to a provisional in-house reference. Callers
 * MUST use this to decide the item/booking status — a provisional reference is
 * never a real confirmation.
 */
type ItemBookingResult =
  | { confirmed: true; confirmationNumber: string }
  | { confirmed: false; confirmationNumber: string; reason: string };

/**
 * Book one item via the provider registry (quote → book → event log → supplier ref).
 * Returns { confirmed: true } only when the live provider returned a real PNR.
 * Never throws — failures return { confirmed: false } with a provisional REF-… reference.
 */
async function confirmItemBooking(
  item: {
    id: string;
    bookingId: string;
    type: string;
    details: unknown;
  },
  passengers: FlightPassenger[],
  agencyId: string,
  agencyReference: string
): Promise<ItemBookingResult> {
  const ctx: ProviderContext = {
    agencyId,
    correlationId: crypto.randomUUID(),
  };

  if (item.type === "flight") {
    const result = await serviceBookFlight({
      bookingId: item.bookingId,
      bookingItemId: item.id,
      agencyId,
      agencyReference,
      offer: item.details as FlightOffer,
      passengers,
      ctx,
    });
    return result.confirmed
      ? { confirmed: true, confirmationNumber: result.confirmationNumber }
      : { confirmed: false, confirmationNumber: result.confirmationNumber, reason: result.reason };
  }

  if (item.type === "hotel") {
    const guests = await buildHotelGuests(item.bookingId);
    const result = await serviceBookHotel({
      bookingId: item.bookingId,
      bookingItemId: item.id,
      agencyId,
      agencyReference,
      offer: item.details as HotelOffer,
      guests,
      ctx,
    });
    return result.confirmed
      ? { confirmed: true, confirmationNumber: result.confirmationNumber }
      : { confirmed: false, confirmationNumber: result.confirmationNumber, reason: result.reason };
  }

  // Item types without an automatic supplier booking (transfer, excursion, …).
  return {
    confirmed: false,
    confirmationNumber: `REF-${Date.now().toString(36).toUpperCase()}`,
    reason: `No automatic supplier booking for item type "${item.type}"`,
  };
}

/** Confirm/book a single item (issue its supplier confirmation number). */
export async function bookItem(
  itemId: string,
  bookingId: string
): Promise<ActionResult<{ confirmationNumber: string }>> {
  const user = await requireAgencyUser();
  // Verify the parent booking belongs to this agency before touching its item.
  const parent = await db.query.booking.findFirst({
    where: and(eq(booking.id, bookingId), eq(booking.agencyId, user.agencyId)),
  });
  if (!parent) return { ok: false, error: "Not found" };

  const item = await db.query.bookingItem.findFirst({
    where: and(eq(bookingItem.id, itemId), eq(bookingItem.bookingId, bookingId)),
  });
  if (!item) return { ok: false, error: "Item not found" };

  const passengers = await buildFlightPassengers(bookingId);
  const result = await confirmItemBooking(item, passengers, user.agencyId, parent.reference);
  // Only a real provider confirmation advances the line to "confirmed"; a
  // provisional reference keeps it "pending" so failures aren't shown as booked.
  await db
    .update(bookingItem)
    .set({
      confirmationNumber: result.confirmationNumber,
      itemStatus: result.confirmed ? "confirmed" : "pending",
    })
    .where(eq(bookingItem.id, itemId));

  await logActivity({
    agencyId: user.agencyId,
    userId: user.id,
    action: "updated",
    entityType: "booking",
    entityId: bookingId,
    entityLabel: item.title,
    metadata: result.confirmed
      ? { confirmed: result.confirmationNumber }
      : { provisional: result.confirmationNumber, reason: result.reason },
  });

  revalidatePath(`/bookings/${bookingId}`);
  return {
    ok: true,
    data: { confirmationNumber: result.confirmationNumber },
  };
}

/** Advance a booking to the next lifecycle status. */
export async function advanceStatus(
  id: string
): Promise<ActionResult<{ status: string }>> {
  const user = await requireAgencyUser();
  const existing = await db.query.booking.findFirst({
    where: and(eq(booking.id, id), eq(booking.agencyId, user.agencyId)),
    with: { items: true },
  });
  if (!existing) return { ok: false, error: "Booking not found" };

  const next = nextBookingStatus(existing.status);
  if (!next) return { ok: false, error: "Booking is already at the final status" };

  // Same items-required + zero-balance gates setBookingStatus enforces.
  const prereq = await checkStatusPrerequisites(existing, next);
  if (prereq) return prereq;

  // When ticketing, ensure every item has a REAL provider confirmation before
  // advancing — a provider failure aborts the advance (see helper).
  if (next === "ticketed") {
    const ticketing = await runTicketingConfirmation(existing, user.agencyId, user.id);
    if (ticketing) return ticketing;
  }

  await db
    .update(booking)
    .set({ status: next })
    .where(and(eq(booking.id, id), eq(booking.agencyId, user.agencyId)));

  if (next === "confirmed" || next === "ticketed") {
    await autoGenerateCommissions(id, user.agencyId);
  }

  await logActivity({
    agencyId: user.agencyId,
    userId: user.id,
    action: "status_changed",
    entityType: "booking",
    entityId: id,
    entityLabel: existing.reference,
    metadata: { from: existing.status, to: next },
  });

  revalidatePath("/bookings");
  revalidatePath("/operations");
  revalidatePath(`/bookings/${id}`);
  return { ok: true, data: { status: next } };
}

// --- Itinerary --------------------------------------------------------------

/** Assign an item to an itinerary day (null = unscheduled). */
export async function assignItemDay(
  itemId: string,
  bookingId: string,
  dayIndex: number | null
): Promise<ActionResult> {
  const user = await requireAgencyUser();
  // Verify the parent booking belongs to this agency before scheduling its item.
  const parent = await db.query.booking.findFirst({
    where: and(eq(booking.id, bookingId), eq(booking.agencyId, user.agencyId)),
  });
  if (!parent) return { ok: false, error: "Not found" };

  await db
    .update(bookingItem)
    .set({ dayIndex })
    .where(and(eq(bookingItem.id, itemId), eq(bookingItem.bookingId, bookingId)));
  revalidatePath(`/bookings/${bookingId}/itinerary`);
  return { ok: true };
}

/** Upsert the title/notes for an itinerary day. */
export async function setDayNote(
  bookingId: string,
  dayIndex: number,
  title: string,
  notes: string
): Promise<ActionResult> {
  const user = await requireAgencyUser();
  // Verify the parent booking belongs to this agency before editing its days.
  const parent = await db.query.booking.findFirst({
    where: and(eq(booking.id, bookingId), eq(booking.agencyId, user.agencyId)),
  });
  if (!parent) return { ok: false, error: "Not found" };

  const existing = await db.query.bookingDay.findFirst({
    where: and(eq(bookingDay.bookingId, bookingId), eq(bookingDay.dayIndex, dayIndex)),
  });
  if (existing) {
    await db
      .update(bookingDay)
      .set({ title: title || null, notes: notes || null })
      .where(eq(bookingDay.id, existing.id));
  } else {
    await db.insert(bookingDay).values({
      bookingId,
      dayIndex,
      title: title || null,
      notes: notes || null,
    });
  }
  revalidatePath(`/bookings/${bookingId}/itinerary`);
  return { ok: true };
}

/** Create (or rotate) a public shareable itinerary link. */
export async function generateShareLink(
  bookingId: string
): Promise<ActionResult<{ token: string }>> {
  const user = await requireAgencyUser();
  const token = crypto.randomUUID().replace(/-/g, "");
  await db
    .update(booking)
    .set({ shareToken: token })
    .where(and(eq(booking.id, bookingId), eq(booking.agencyId, user.agencyId)));
  revalidatePath(`/bookings/${bookingId}/itinerary`);
  return { ok: true, data: { token } };
}

/** Disable the public shareable link. */
export async function revokeShareLink(bookingId: string): Promise<ActionResult> {
  const user = await requireAgencyUser();
  await db
    .update(booking)
    .set({ shareToken: null })
    .where(and(eq(booking.id, bookingId), eq(booking.agencyId, user.agencyId)));
  revalidatePath(`/bookings/${bookingId}/itinerary`);
  return { ok: true };
}

// --- Travellers -------------------------------------------------------------

const travellerInput = z.object({
  fullName: z.string().trim().min(1, "Name is required").max(200),
  title: z.enum(TITLES).optional().or(z.literal("")),
  gender: z.enum(GENDERS).optional().or(z.literal("")),
  passportNumber: z.string().trim().max(60).optional(),
  passportExpiry: z.string().optional(),
  nationality: z.string().trim().max(80).optional(),
  dateOfBirth: z.string().optional(),
  passportIssueDate: z.string().optional(),
  passportIssuePlace: z.string().trim().max(120).optional(),
  isLead: z.boolean().optional(),
});

export type TravellerInput = z.input<typeof travellerInput>;

export async function addTraveller(
  bookingId: string,
  input: TravellerInput
): Promise<ActionResult> {
  const user = await requireAgencyUser();
  const parsed = travellerInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  // Verify the parent booking belongs to this agency before adding a traveller.
  const parent = await db.query.booking.findFirst({
    where: and(eq(booking.id, bookingId), eq(booking.agencyId, user.agencyId)),
  });
  if (!parent) return { ok: false, error: "Not found" };

  const d = parsed.data;
  const count = await db.$count(
    bookingTraveller,
    eq(bookingTraveller.bookingId, bookingId)
  );

  await db.insert(bookingTraveller).values({
    bookingId,
    fullName: d.fullName,
    title: d.title || null,
    gender: d.gender || null,
    passportNumber: d.passportNumber || null,
    passportExpiry: toDate(d.passportExpiry),
    nationality: d.nationality || null,
    dateOfBirth: toDate(d.dateOfBirth),
    passportIssueDate: toDate(d.passportIssueDate),
    passportIssuePlace: d.passportIssuePlace || null,
    isLead: d.isLead ?? count === 0,
    sortOrder: count,
  });

  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

export async function updateTraveller(
  id: string,
  bookingId: string,
  input: TravellerInput
): Promise<ActionResult> {
  const user = await requireAgencyUser();
  const parsed = travellerInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  // Verify the parent booking belongs to this agency before editing its traveller.
  const parent = await db.query.booking.findFirst({
    where: and(eq(booking.id, bookingId), eq(booking.agencyId, user.agencyId)),
  });
  if (!parent) return { ok: false, error: "Not found" };

  const d = parsed.data;
  await db
    .update(bookingTraveller)
    .set({
      fullName: d.fullName,
      title: d.title || null,
      gender: d.gender || null,
      passportNumber: d.passportNumber || null,
      passportExpiry: toDate(d.passportExpiry),
      nationality: d.nationality || null,
      dateOfBirth: toDate(d.dateOfBirth),
      passportIssueDate: toDate(d.passportIssueDate),
      passportIssuePlace: d.passportIssuePlace || null,
    })
    .where(
      and(eq(bookingTraveller.id, id), eq(bookingTraveller.bookingId, bookingId))
    );

  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

export async function removeTraveller(
  id: string,
  bookingId: string
): Promise<ActionResult> {
  const user = await requireAgencyUser();
  // Verify the parent booking belongs to this agency before removing its traveller.
  const parent = await db.query.booking.findFirst({
    where: and(eq(booking.id, bookingId), eq(booking.agencyId, user.agencyId)),
  });
  if (!parent) return { ok: false, error: "Not found" };

  await db
    .delete(bookingTraveller)
    .where(
      and(eq(bookingTraveller.id, id), eq(bookingTraveller.bookingId, bookingId))
    );
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

// --- Items ------------------------------------------------------------------

const itemInput = z.object({
  type: z.enum(["flight", "hotel", "transfer", "excursion", "insurance", "fee", "other"]),
  title: z.string().trim().min(1, "Title is required").max(300),
  description: z.string().trim().max(2000).optional(),
  supplier: z.string().trim().max(120).optional(),
  supplierId: z.string().uuid().optional(),
  bookingRef: z.string().trim().max(120).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  amount: z.coerce.number().min(0).default(0),
  currency: z.string().trim().min(1).max(8).default("DZD"),
  details: z.unknown().optional(),
});

export type BookingItemInput = z.input<typeof itemInput>;

export async function addBookingItem(
  bookingId: string,
  input: BookingItemInput
): Promise<ActionResult> {
  const user = await requireAgencyUser();
  const parsed = itemInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid item" };
  }
  // Verify the parent booking belongs to this agency before adding an item.
  const parent = await db.query.booking.findFirst({
    where: and(eq(booking.id, bookingId), eq(booking.agencyId, user.agencyId)),
  });
  if (!parent) return { ok: false, error: "Not found" };

  const d = parsed.data;
  const count = await db.$count(bookingItem, eq(bookingItem.bookingId, bookingId));

  await db.insert(bookingItem).values({
    bookingId,
    type: d.type,
    title: d.title,
    description: d.description || null,
    supplierId: d.supplierId ?? null,
    supplier: d.supplier || null,
    bookingRef: d.bookingRef || null,
    startDate: toDate(d.startDate),
    endDate: toDate(d.endDate),
    quantity: d.quantity,
    amount: String(d.amount),
    currency: d.currency,
    details: (d.details as object) ?? null,
    sortOrder: count,
  });

  await recalcTotal(bookingId, user.agencyId);
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

export async function removeBookingItem(
  id: string,
  bookingId: string
): Promise<ActionResult> {
  const user = await requireAgencyUser();
  // Verify the parent booking belongs to this agency before removing its item.
  const parent = await db.query.booking.findFirst({
    where: and(eq(booking.id, bookingId), eq(booking.agencyId, user.agencyId)),
  });
  if (!parent) return { ok: false, error: "Not found" };

  await db
    .delete(bookingItem)
    .where(and(eq(bookingItem.id, id), eq(bookingItem.bookingId, bookingId)));
  await recalcTotal(bookingId, user.agencyId);
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

/**
 * Adds an item to an existing booking, or creates a new draft booking first.
 * Used by the search results "Add to booking" flow.
 */
export async function addItemToBooking(input: {
  bookingId?: string | undefined;
  clientId?: string | undefined;
  destination?: string | undefined;
  item: BookingItemInput;
}): Promise<ActionResult<{ bookingId: string }>> {
  const user = await requireAgencyUser();
  let bookingId = input.bookingId;

  if (!bookingId) {
    const created = await createBooking({
      clientId: input.clientId,
      destination: input.destination,
      currency: input.item.currency,
    });
    if (!created.ok || !created.data) {
      return { ok: false, error: created.ok ? "Failed to create booking" : created.error };
    }
    bookingId = created.data.id;
  }

  const res = await addBookingItem(bookingId, input.item);
  if (!res.ok) return res;

  await logActivity({
    agencyId: user.agencyId,
    userId: user.id,
    action: "updated",
    entityType: "booking",
    entityId: bookingId,
    entityLabel: input.item.title,
    metadata: { itemAdded: input.item.type },
  });

  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true, data: { bookingId } };
}

// --- Proposal → Booking conversion ------------------------------------------

/**
 * Maps a product (proposal) item type to its booking item-type equivalent.
 * The two enums overlap except for "activity", which a booking calls
 * "excursion". Unknown types fall back to "other".
 */
function productItemTypeToBookingItemType(
  type: string
): BookingItemInput["type"] {
  switch (type) {
    case "flight":
    case "hotel":
    case "transfer":
    case "insurance":
    case "other":
      return type;
    case "activity":
      return "excursion";
    default:
      return "other";
  }
}

/**
 * Core proposal → booking conversion. **Tenant-safe & auth-agnostic.**
 *
 * This is the single source of truth for turning an accepted proposal into a
 * booking. It deliberately does NOT call `requireAgencyUser`, because it must
 * run on the **public client path** too (portal accept / public-token accept),
 * where there is no authenticated agent session.
 *
 * Tenant safety: everything is scoped to the PROPOSAL's own `product.agencyId`,
 * derived from the loaded row — never from a caller-supplied agency. The new
 * booking and its items inherit that agency.
 *
 * Idempotency: a proposal never spawns two bookings. If `product.convertedBookingId`
 * is already set, this returns that booking id as a no-op. Re-accepting, double
 * submits and the manual convert button are therefore all safe.
 *
 * @param productId The proposal (product) id.
 * @param opts.actorUserId The agent who owns/triggers the conversion, or null
 *   (system) on the unauthenticated client path. Becomes `booking.createdById`
 *   and the activity actor.
 * @param opts.requireAccepted When true (agent path), refuses to convert a
 *   proposal whose status is not "accepted".
 */
export async function createBookingFromAcceptedProposal(
  productId: string,
  opts: { actorUserId?: string | null; requireAccepted?: boolean } = {}
): Promise<ActionResult<{ id: string }>> {
  const actorUserId = opts.actorUserId ?? null;

  // Load the proposal + items with NO agency filter here — we derive the tenant
  // from the row itself. (The public callers have no agencyId to pass; the agent
  // caller has already validated ownership before delegating.)
  const p = await db.query.product.findFirst({
    where: eq(product.id, productId),
    with: { items: true },
  });
  if (!p) return { ok: false, error: "Proposal not found" };

  if (opts.requireAccepted && p.status !== "accepted") {
    return { ok: false, error: "Only accepted proposals can be converted" };
  }

  const agencyId = p.agencyId; // the ONLY trusted tenant scope from here on.

  // Idempotency guard: if this proposal already spawned a booking, return it.
  if (p.convertedBookingId) {
    return { ok: true, data: { id: p.convertedBookingId } };
  }

  // Validate the linked client belongs to the proposal's agency before carrying
  // it onto the booking (defensive — proposals are agency-scoped already).
  let clientId: string | null = null;
  if (p.clientId) {
    const c = await db.query.client.findFirst({
      where: and(eq(client.id, p.clientId), eq(client.agencyId, agencyId)),
    });
    clientId = c ? c.id : null;
  }

  // Total charged to the client = Σ(unitPrice × quantity) across line items.
  const totalAmount = round2(
    p.items.reduce(
      (s, it) => s + parseFloat(it.unitPrice || "0") * it.quantity,
      0
    )
  );

  // Snapshot the deposit % agreed for THIS deal onto the booking, resolving the
  // override chain at conversion time: the proposal's per-deal override falls
  // back to the agency default. Snapshotting freezes signed terms so a later
  // change to the agency default can never alter this booking's deposit gate.
  const ag = await db.query.agency.findFirst({
    where: eq(agency.id, agencyId),
    columns: { depositPercent: true },
  });
  const snapshotDepositPercent = String(
    round2(effectiveDepositPercent(p.depositPercent, ag?.depositPercent))
  );

  // Generate a per-agency reference the same way createBooking does, retrying on
  // the rare concurrent-insert collision.
  let reference = "";
  let bookingRow: { id: string } | undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    reference = await nextReference(agencyId);
    try {
      [bookingRow] = await db
        .insert(booking)
        .values({
          agencyId,
          reference,
          clientId,
          destination: p.destination ?? null,
          currency: p.currency,
          notes: p.summary ?? null,
          status: "awaiting_payment",
          totalAmount: String(totalAmount),
          // Frozen deposit terms for this deal (see snapshotDepositPercent above).
          depositPercent: snapshotDepositPercent,
          createdById: actorUserId,
        })
        .returning({ id: booking.id });
      break;
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 4) continue;
      throw e;
    }
  }
  if (!bookingRow) return { ok: false, error: "Failed to create booking" };
  const bookingId = bookingRow.id;

  // Carry each proposal line item over to a booking item. The client price
  // (unitPrice) becomes the booking item amount. All rows inherit the proposal's
  // agency via the parent booking.
  if (p.items.length > 0) {
    await db.insert(bookingItem).values(
      p.items.map((it, i) => ({
        bookingId,
        type: productItemTypeToBookingItemType(it.type),
        title: it.title,
        description: it.description ?? null,
        supplierId: it.supplierId ?? null,
        supplier: it.supplier ?? null,
        quantity: it.quantity,
        amount: it.unitPrice,
        currency: it.currency,
        sortOrder: i,
      }))
    );
  }

  // Link the proposal to its booking — this is the idempotency latch. The update
  // is guarded on convertedBookingId still being NULL, so a racing second call
  // (concurrent double-accept/double-submit, where both passed the early NULL
  // check and both inserted a booking) can win the latch for only ONE of them.
  // The loser's WHERE matches 0 rows; we then delete its now-orphaned booking and
  // return the winning booking id, so the proposal never keeps two live bookings.
  const [latched] = await db
    .update(product)
    .set({ convertedBookingId: bookingId })
    .where(
      and(
        eq(product.id, p.id),
        eq(product.agencyId, agencyId),
        isNull(product.convertedBookingId)
      )
    )
    .returning({ convertedBookingId: product.convertedBookingId });

  if (!latched) {
    // Someone else latched first. Roll back our orphaned booking + its items and
    // return whichever booking actually won the latch. Scope the delete to this
    // agency's booking (defensive; the id is one we just created).
    await db
      .delete(booking)
      .where(and(eq(booking.id, bookingId), eq(booking.agencyId, agencyId)));
    const winner = await db.query.product.findFirst({
      where: and(eq(product.id, p.id), eq(product.agencyId, agencyId)),
      columns: { convertedBookingId: true },
    });
    if (winner?.convertedBookingId) {
      return { ok: true, data: { id: winner.convertedBookingId } };
    }
    return { ok: false, error: "Failed to link booking" };
  }

  await logActivity({
    agencyId,
    userId: actorUserId,
    action: "created",
    entityType: "booking",
    entityId: bookingId,
    entityLabel: p.title,
    metadata: { convertedFromProposal: p.reference },
  });

  return { ok: true, data: { id: bookingId } };
}

/**
 * Converts an accepted proposal into a new booking, pre-filled with the
 * proposal's client, destination and line items. Only accepted proposals can
 * be converted. Agent entry point — enforces the agency guard, then delegates
 * to the shared, idempotent core helper.
 */
export async function convertProposalToBooking(
  productId: string
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAgencyUser();

  // Agency guard: the proposal must belong to the caller's agency.
  const p = await db.query.product.findFirst({
    where: and(eq(product.id, productId), eq(product.agencyId, user.agencyId)),
    columns: { id: true, status: true },
  });
  if (!p) return { ok: false, error: "Proposal not found" };
  if (p.status !== "accepted") {
    return { ok: false, error: "Only accepted proposals can be converted" };
  }

  const result = await createBookingFromAcceptedProposal(productId, {
    actorUserId: user.id,
    requireAccepted: true,
  });
  if (!result.ok) return result;

  revalidatePath("/bookings");
  revalidatePath(`/proposals/${productId}`);
  revalidatePath(`/products/${productId}`);
  return result;
}
