import { tool } from "ai";
import { and, asc, desc, eq, gte, ilike, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  BOOKING_STATUSES,
  BOOKING_STATUS_META,
  DEFAULT_CURRENCY,
  type BookingStatus,
} from "@/lib/domain";
import { paymentSummary } from "@/lib/payments/summary";
import {
  booking as bookingTable,
  bookingTraveller,
  client as clientTable,
} from "@/lib/schema";

const MAX_ROWS = 25;

/**
 * Read-only booking tools for the Atlas AI assistant, scoped to one agency.
 *
 * TENANT SAFETY: every query is constrained to `ctx.agencyId`. The child tables
 * (booking_traveller, booking_item, payment) carry no agencyId of their own —
 * they are only ever loaded through a parent `booking` row that we first prove
 * belongs to this agency, so a cross-tenant read is impossible.
 *
 * These mirror the real queries in:
 *   - src/app/(app)/bookings/page.tsx        (list + traveller counts)
 *   - src/app/(app)/bookings/[id]/page.tsx   (full booking file)
 */
export function makeBookingTools(ctx: { agencyId: string }) {
  const agencyScope = eq(bookingTable.agencyId, ctx.agencyId);

  return {
    listBookings: tool({
      description:
        "List and filter this agency's bookings by status, client name, destination or departure-date window. " +
        "Use for questions like 'which bookings were cancelled' (returns the client names), " +
        "'what departs next week', 'show me draft bookings', 'bookings to Marrakech', or " +
        "'trips leaving before the 20th'. Returns booking reference, client, status, destination, dates, " +
        "traveller count (pax) and total value + currency. Amounts are per-booking raw values with their " +
        "own currency — never sum across different currencies.",
      inputSchema: z.object({
        status: z
          .enum(BOOKING_STATUSES)
          .optional()
          .describe(
            "Filter by lifecycle status: draft, awaiting_payment, confirmed, ticketed, completed, cancelled."
          ),
        clientName: z
          .string()
          .optional()
          .describe("Partial client name to match (case-insensitive)."),
        destination: z
          .string()
          .optional()
          .describe("Partial destination to match, e.g. 'Paris' or 'Morocco'."),
        departingAfter: z
          .string()
          .optional()
          .describe("Only bookings departing on/after this date (yyyy-mm-dd)."),
        departingBefore: z
          .string()
          .optional()
          .describe("Only bookings departing on/before this date (yyyy-mm-dd)."),
      }),
      execute: async (a) => {
        try {
          // Build a client-name subquery filter without a join: match booking's
          // clientId against clients in THIS agency whose name matches. This keeps
          // the name filter tenant-scoped on both sides.
          const conditions = [agencyScope];

          if (a.status) {
            conditions.push(eq(bookingTable.status, a.status));
          }
          if (a.destination) {
            conditions.push(ilike(bookingTable.destination, `%${a.destination}%`));
          }
          if (a.departingAfter) {
            const d = new Date(a.departingAfter);
            if (!Number.isNaN(d.getTime())) {
              conditions.push(gte(bookingTable.departDate, d));
            }
          }
          if (a.departingBefore) {
            const d = new Date(a.departingBefore);
            if (!Number.isNaN(d.getTime())) {
              conditions.push(lte(bookingTable.departDate, d));
            }
          }
          if (a.clientName) {
            // agency-scoped client id set for the name match.
            conditions.push(
              sql`${bookingTable.clientId} in (select ${clientTable.id} from ${clientTable} where ${clientTable.agencyId} = ${ctx.agencyId} and ${clientTable.name} ilike ${`%${a.clientName}%`})`
            );
          }

          const where = and(...conditions);

          // Total matching count (for "showing 25 of N").
          const [{ count } = { count: 0 }] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(bookingTable)
            .where(where);

          const rows = await db.query.booking.findMany({
            where,
            with: { client: { columns: { name: true } } },
            // Sensible ordering: soonest upcoming departures first, then most
            // recently created (bookings with no departDate fall to the end).
            orderBy: [asc(bookingTable.departDate), desc(bookingTable.createdAt)],
            limit: MAX_ROWS,
          });

          // Traveller counts for the returned bookings only (children have no
          // agencyId — safe because these bookingIds are all agency-scoped above).
          const ids = rows.map((r) => r.id);
          const countMap = new Map<string, number>();
          if (ids.length > 0) {
            const counts = await db
              .select({
                bookingId: bookingTraveller.bookingId,
                count: sql<number>`count(*)::int`,
              })
              .from(bookingTraveller)
              .where(inArray(bookingTraveller.bookingId, ids))
              .groupBy(bookingTraveller.bookingId);
            for (const c of counts) countMap.set(c.bookingId, c.count);
          }

          return {
            ok: true,
            totalCount: count,
            truncated: count > rows.length,
            bookings: rows.map((b) => ({
              reference: b.reference,
              clientName: b.client?.name ?? null,
              status: b.status,
              statusLabel:
                BOOKING_STATUS_META[b.status as BookingStatus]?.label ?? b.status,
              destination: b.destination,
              startDate: b.departDate,
              endDate: b.returnDate,
              pax: countMap.get(b.id) ?? 0,
              totalValue: parseFloat(b.totalAmount || "0"),
              currency: b.currency || DEFAULT_CURRENCY,
            })),
          };
        } catch (err) {
          console.error("[chat:tool:listBookings]", err);
          return { ok: false, error: "Could not list bookings. Please try again." };
        }
      },
    }),

    getBookingDetails: tool({
      description:
        "Open the full booking file for one booking, looked up by its reference (e.g. 'BKG-1042') or its id. " +
        "Returns the client, status, destination, travel dates, travellers (name + passport), the purchased " +
        "items (flights, hotels, extras with supplier, dates, amount and item status), and the payment summary " +
        "(total, paid, balance, currency). Use for 'show me booking BKG-1042', 'who is travelling on that trip', " +
        "'what's the balance due on…', 'what's included in booking …'.",
      inputSchema: z
        .object({
          reference: z
            .string()
            .optional()
            .describe("The booking reference, e.g. 'BKG-1042'."),
          bookingId: z
            .string()
            .optional()
            .describe("The booking UUID, if known (e.g. from listBookings)."),
        })
        .refine((v) => v.reference || v.bookingId, {
          message: "Provide either reference or bookingId.",
        }),
      execute: async (a) => {
        try {
          if (!a.reference && !a.bookingId) {
            return { ok: false, error: "Provide a booking reference or id." };
          }

          // Always AND the agency scope so a guessed reference/id from another
          // tenant can never resolve. The lookup key (reference OR id) is ORed
          // together, then the whole thing is scoped.
          const keyMatch = a.bookingId
            ? eq(bookingTable.id, a.bookingId)
            : eq(bookingTable.reference, a.reference!);

          const b = await db.query.booking.findFirst({
            where: and(agencyScope, keyMatch),
            with: {
              client: { columns: { id: true, name: true, email: true } },
              travellers: {
                orderBy: (t) => [asc(t.sortOrder)],
                columns: {
                  fullName: true,
                  passportNumber: true,
                  passportExpiry: true,
                  nationality: true,
                  isLead: true,
                },
              },
              items: {
                orderBy: (t) => [asc(t.sortOrder)],
                columns: {
                  type: true,
                  title: true,
                  supplier: true,
                  bookingRef: true,
                  confirmationNumber: true,
                  startDate: true,
                  endDate: true,
                  quantity: true,
                  amount: true,
                  currency: true,
                  itemStatus: true,
                },
              },
              payments: {
                orderBy: (t) => [desc(t.createdAt)],
                columns: { amount: true, kind: true, status: true },
              },
            },
          });

          if (!b) {
            return { ok: false, error: "Booking not found in this agency." };
          }

          const total = parseFloat(b.totalAmount || "0");
          const { paid, balance } = paymentSummary(b.payments, total);

          return {
            ok: true,
            booking: {
              id: b.id,
              reference: b.reference,
              status: b.status,
              statusLabel:
                BOOKING_STATUS_META[b.status as BookingStatus]?.label ?? b.status,
              client: b.client
                ? { name: b.client.name, email: b.client.email }
                : null,
              destination: b.destination,
              startDate: b.departDate,
              endDate: b.returnDate,
              notes: b.notes,
              travellers: b.travellers.map((t) => ({
                fullName: t.fullName,
                passportNumber: t.passportNumber,
                passportExpiry: t.passportExpiry,
                nationality: t.nationality,
                isLead: t.isLead,
              })),
              items: b.items.map((i) => ({
                type: i.type,
                title: i.title,
                supplier: i.supplier,
                bookingRef: i.bookingRef,
                confirmationNumber: i.confirmationNumber,
                startDate: i.startDate,
                endDate: i.endDate,
                quantity: i.quantity,
                amount: parseFloat(i.amount || "0"),
                currency: i.currency || DEFAULT_CURRENCY,
                itemStatus: i.itemStatus,
              })),
              payment: {
                total,
                paid,
                balance,
                currency: b.currency || DEFAULT_CURRENCY,
              },
            },
          };
        } catch (err) {
          console.error("[chat:tool:getBookingDetails]", err);
          return {
            ok: false,
            error: "Could not load the booking details. Please try again.",
          };
        }
      },
    }),
  };
}
