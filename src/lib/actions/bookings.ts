"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { canDeleteRecords, nextBookingStatus } from "@/lib/domain";
import { requireAgencyUser } from "@/lib/permissions";
import { booking, bookingTraveller, bookingItem, bookingDay, client } from "@/lib/schema";
import {
  getFlightSupplier,
  getHotelSupplier,
  type FlightOffer,
  type HotelOffer,
} from "@/lib/suppliers";

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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

async function recalcTotal(bookingId: string): Promise<void> {
  const items = await db
    .select({ amount: bookingItem.amount, quantity: bookingItem.quantity })
    .from(bookingItem)
    .where(eq(bookingItem.bookingId, bookingId));
  const total = items.reduce(
    (s, i) => s + parseFloat(i.amount || "0") * i.quantity,
    0
  );
  await db
    .update(booking)
    .set({ totalAmount: String(round2(total)) })
    .where(eq(booking.id, bookingId));
}

// --- Booking CRUD -----------------------------------------------------------

const bookingInput = z.object({
  clientId: z.string().optional(),
  destination: z.string().trim().max(200).optional(),
  departDate: z.string().optional(),
  returnDate: z.string().optional(),
  currency: z.string().trim().min(1).max(8).default("EUR"),
  notes: z.string().trim().max(5000).optional(),
  leadTravellerName: z.string().trim().max(200).optional(),
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
      currency: d.currency,
      notes: d.notes || null,
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

export async function setBookingStatus(
  id: string,
  status: "draft" | "confirmed" | "paid" | "cancelled"
): Promise<ActionResult> {
  const user = await requireAgencyUser();
  const existing = await db.query.booking.findFirst({
    where: and(eq(booking.id, id), eq(booking.agencyId, user.agencyId)),
  });
  if (!existing) return { ok: false, error: "Booking not found" };

  await db
    .update(booking)
    .set({ status })
    .where(and(eq(booking.id, id), eq(booking.agencyId, user.agencyId)));

  await logActivity({
    agencyId: user.agencyId,
    userId: user.id,
    action: "status_changed",
    entityType: "booking",
    entityId: id,
    entityLabel: existing.reference,
    metadata: { to: status },
  });

  revalidatePath("/bookings");
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

/** Book one item with the active supplier and store its confirmation number. */
async function confirmItemBooking(item: {
  type: string;
  details: unknown;
}): Promise<string> {
  try {
    if (item.type === "flight") {
      return (
        await getFlightSupplier().bookFlight(item.details as FlightOffer)
      ).confirmationNumber;
    }
    if (item.type === "hotel") {
      return (
        await getHotelSupplier().bookHotel(item.details as HotelOffer)
      ).confirmationNumber;
    }
  } catch (error) {
    console.error("Supplier booking failed, issuing manual reference:", error);
  }
  return `REF-${Date.now().toString(36).toUpperCase()}`;
}

/** Confirm/book a single item (issue its supplier confirmation number). */
export async function bookItem(
  itemId: string,
  bookingId: string
): Promise<ActionResult> {
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

  const confirmationNumber = await confirmItemBooking(item);
  await db
    .update(bookingItem)
    .set({ confirmationNumber, itemStatus: "confirmed" })
    .where(eq(bookingItem.id, itemId));

  await logActivity({
    agencyId: user.agencyId,
    userId: user.id,
    action: "updated",
    entityType: "booking",
    entityId: bookingId,
    entityLabel: item.title,
    metadata: { confirmed: confirmationNumber },
  });

  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
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

  // When ticketing, ensure every item has a confirmation number.
  if (next === "ticketed") {
    for (const item of existing.items) {
      if (item.confirmationNumber) continue;
      const confirmationNumber = await confirmItemBooking(item);
      await db
        .update(bookingItem)
        .set({ confirmationNumber, itemStatus: "ticketed" })
        .where(eq(bookingItem.id, item.id));
    }
  }

  await db
    .update(booking)
    .set({ status: next })
    .where(and(eq(booking.id, id), eq(booking.agencyId, user.agencyId)));

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
  bookingRef: z.string().trim().max(120).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  amount: z.coerce.number().min(0).default(0),
  currency: z.string().trim().min(1).max(8).default("EUR"),
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

  await recalcTotal(bookingId);
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
  await recalcTotal(bookingId);
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
