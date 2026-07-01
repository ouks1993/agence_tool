"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import {
  canManagePayments,
  canViewFinance,
  COMMISSION_BASES,
  COMMISSION_STATUSES,
  COMMISSION_TYPES,
  SUPPORTED_CURRENCIES,
} from "@/lib/domain";
import { requireAgencyUser } from "@/lib/permissions";
import {
  booking,
  bookingItem,
  commission,
  supplier,
  supplierContract,
  user as userTable,
} from "@/lib/schema";

// --- Manual CRUD ------------------------------------------------------------

const commissionInput = z.object({
  bookingId: z.string().uuid().optional(),
  bookingItemId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  agentUserId: z.string().min(1).optional(),
  type: z.enum(COMMISSION_TYPES),
  basis: z.enum(COMMISSION_BASES),
  rate: z.number().nonnegative().optional(),
  baseAmount: z.number().nonnegative().optional(),
  amount: z.number().nonnegative(),
  currency: z.enum(SUPPORTED_CURRENCIES),
  status: z.enum(COMMISSION_STATUSES),
  note: z.string().trim().max(5000).optional(),
});

export type CommissionInput = z.infer<typeof commissionInput>;

export async function recordCommission(
  input: CommissionInput
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAgencyUser();

  if (!canManagePayments(user.role)) {
    return { ok: false, error: "You don't have permission to manage commissions" };
  }

  const parsed = commissionInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;

  // Cross-tenant FK guards: every referenced id must resolve to a row scoped to
  // the caller's agency before the insert. Without these, a foreign-tenant id
  // could be persisted as an FK (or used as an existence oracle).

  // When a booking is referenced, verify it belongs to this agency so a
  // commission can never be attached to another tenant's booking.
  if (d.bookingId) {
    const parent = await db.query.booking.findFirst({
      where: and(eq(booking.id, d.bookingId), eq(booking.agencyId, user.agencyId)),
      columns: { id: true },
    });
    if (!parent) return { ok: false, error: "Booking not found" };
  }

  // Booking items have no agencyId of their own — scope through the parent
  // booking's agencyId via a join.
  if (d.bookingItemId) {
    const [item] = await db
      .select({ id: bookingItem.id })
      .from(bookingItem)
      .innerJoin(booking, eq(bookingItem.bookingId, booking.id))
      .where(
        and(
          eq(bookingItem.id, d.bookingItemId),
          eq(booking.agencyId, user.agencyId)
        )
      );
    if (!item) return { ok: false, error: "Booking item not found" };
  }

  // The referenced supplier must belong to this agency.
  if (d.supplierId) {
    const sup = await db.query.supplier.findFirst({
      where: and(
        eq(supplier.id, d.supplierId),
        eq(supplier.agencyId, user.agencyId)
      ),
      columns: { id: true },
    });
    if (!sup) return { ok: false, error: "Supplier not found" };
  }

  // The referenced agent must belong to this agency.
  if (d.agentUserId) {
    const agent = await db.query.user.findFirst({
      where: and(
        eq(userTable.id, d.agentUserId),
        eq(userTable.agencyId, user.agencyId)
      ),
      columns: { id: true },
    });
    if (!agent) return { ok: false, error: "Agent not found" };
  }

  try {
    const [row] = await db
      .insert(commission)
      .values({
        agencyId: user.agencyId,
        bookingId: d.bookingId ?? null,
        bookingItemId: d.bookingItemId ?? null,
        supplierId: d.supplierId ?? null,
        agentUserId: d.agentUserId ?? null,
        type: d.type,
        basis: d.basis,
        rate: d.rate != null ? String(d.rate) : null,
        baseAmount: d.baseAmount != null ? String(d.baseAmount) : null,
        amount: String(d.amount),
        currency: d.currency,
        status: d.status,
        note: d.note || null,
        createdById: user.id,
      })
      .returning({ id: commission.id });

    if (!row) return { ok: false, error: "Failed to record commission" };

    await logActivity({
      agencyId: user.agencyId,
      userId: user.id,
      action: "created",
      entityType: "commission",
      entityId: row.id,
      entityLabel: `${d.type} · ${d.amount} ${d.currency}`,
    });

    revalidatePath("/commissions");
    if (d.bookingId) revalidatePath(`/bookings/${d.bookingId}`);
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    console.error("[recordCommission]", err);
    return { ok: false, error: "Could not record commission. Please try again." };
  }
}

export async function updateCommissionStatus(
  id: string,
  status: (typeof COMMISSION_STATUSES)[number]
): Promise<ActionResult> {
  const user = await requireAgencyUser();

  if (!canManagePayments(user.role)) {
    return { ok: false, error: "You don't have permission to manage commissions" };
  }

  if (!COMMISSION_STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status" };
  }

  const existing = await db.query.commission.findFirst({
    where: and(eq(commission.id, id), eq(commission.agencyId, user.agencyId)),
  });
  if (!existing) return { ok: false, error: "Commission not found" };

  try {
    await db
      .update(commission)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(commission.id, id), eq(commission.agencyId, user.agencyId)));

    await logActivity({
      agencyId: user.agencyId,
      userId: user.id,
      action: "status_changed",
      entityType: "commission",
      entityId: id,
      metadata: { from: existing.status, to: status },
    });

    revalidatePath("/commissions");
    if (existing.bookingId) revalidatePath(`/bookings/${existing.bookingId}`);
    return { ok: true };
  } catch (err) {
    console.error("[updateCommissionStatus]", err);
    return { ok: false, error: "Could not update the commission. Please try again." };
  }
}

export async function voidCommission(id: string): Promise<ActionResult> {
  const user = await requireAgencyUser();

  if (!canManagePayments(user.role)) {
    return { ok: false, error: "You don't have permission to manage commissions" };
  }

  const existing = await db.query.commission.findFirst({
    where: and(eq(commission.id, id), eq(commission.agencyId, user.agencyId)),
  });
  if (!existing) return { ok: false, error: "Commission not found" };

  try {
    await db
      .update(commission)
      .set({ status: "void", updatedAt: new Date() })
      .where(and(eq(commission.id, id), eq(commission.agencyId, user.agencyId)));

    await logActivity({
      agencyId: user.agencyId,
      userId: user.id,
      action: "status_changed",
      entityType: "commission",
      entityId: id,
      metadata: { from: existing.status, to: "void" },
    });

    revalidatePath("/commissions");
    if (existing.bookingId) revalidatePath(`/bookings/${existing.bookingId}`);
    return { ok: true };
  } catch (err) {
    console.error("[voidCommission]", err);
    return { ok: false, error: "Could not void the commission. Please try again." };
  }
}

export async function deleteCommission(id: string): Promise<ActionResult> {
  const user = await requireAgencyUser();

  if (!canManagePayments(user.role)) {
    return { ok: false, error: "You don't have permission to manage commissions" };
  }

  const existing = await db.query.commission.findFirst({
    where: and(eq(commission.id, id), eq(commission.agencyId, user.agencyId)),
  });
  if (!existing) return { ok: false, error: "Commission not found" };

  // Only void or pending commissions can be hard-deleted; anything that has
  // progressed (earned/invoiced/paid) is a financial record we keep for audit.
  if (existing.status !== "void" && existing.status !== "pending") {
    return {
      ok: false,
      error: "Only void or pending commissions can be deleted",
    };
  }

  try {
    await db
      .delete(commission)
      .where(and(eq(commission.id, id), eq(commission.agencyId, user.agencyId)));

    await logActivity({
      agencyId: user.agencyId,
      userId: user.id,
      action: "deleted",
      entityType: "commission",
      entityId: id,
    });

    revalidatePath("/commissions");
    if (existing.bookingId) revalidatePath(`/bookings/${existing.bookingId}`);
    return { ok: true };
  } catch (err) {
    console.error("[deleteCommission]", err);
    return { ok: false, error: "Could not delete the commission. Please try again." };
  }
}

// --- Queries ----------------------------------------------------------------

export type CommissionFilters = {
  type?: string;
  status?: string;
  agentUserId?: string;
  bookingId?: string;
  // Accept ISO strings (from search params) or Date objects.
  dateFrom?: string | Date;
  dateTo?: string | Date;
};

export type CommissionWithLabels = typeof commission.$inferSelect & {
  bookingRef: string | null;
  agentName: string | null;
  supplierName: string | null;
};

/** Coerce a string/Date filter into a Date, or null if unparseable. */
function toFilterDate(value: string | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getCommissions(filters?: CommissionFilters): Promise<CommissionWithLabels[]> {
  const user = await requireAgencyUser();

  // The commission ledger is finance-only; agents cannot read the agency-wide
  // ledger by calling this action directly.
  if (!canViewFinance(user.role)) return [];

  const conditions: SQL[] = [eq(commission.agencyId, user.agencyId)];
  if (filters?.type) conditions.push(eq(commission.type, filters.type));
  if (filters?.status) conditions.push(eq(commission.status, filters.status));
  if (filters?.agentUserId) {
    conditions.push(eq(commission.agentUserId, filters.agentUserId));
  }
  if (filters?.bookingId) {
    conditions.push(eq(commission.bookingId, filters.bookingId));
  }
  if (filters?.dateFrom) {
    const from = toFilterDate(filters.dateFrom);
    if (from) conditions.push(gte(commission.createdAt, from));
  }
  if (filters?.dateTo) {
    const to = toFilterDate(filters.dateTo);
    if (to) conditions.push(lte(commission.createdAt, to));
  }

  const rows = await db
    .select({
      commission,
      bookingRef: booking.reference,
      agentName: userTable.name,
      supplierName: supplier.name,
    })
    .from(commission)
    .leftJoin(booking, eq(booking.id, commission.bookingId))
    .leftJoin(userTable, eq(userTable.id, commission.agentUserId))
    .leftJoin(supplier, eq(supplier.id, commission.supplierId))
    .where(and(...conditions))
    .orderBy(desc(commission.createdAt));

  return rows.map((row) => ({
    ...row.commission,
    bookingRef: row.bookingRef,
    agentName: row.agentName,
    supplierName: row.supplierName,
  }));
}

export async function getCommissionsByBooking(bookingId: string): Promise<CommissionWithLabels[]> {
  const user = await requireAgencyUser();

  // Finance-only: booking-detail commissions are shown only to finance-capable
  // roles (the booking page already gates on this, but guard here too so a
  // direct action call can't leak the booking's commission lines).
  if (!canViewFinance(user.role)) return [];

  // Verify the booking belongs to this agency before exposing its commissions.
  const parent = await db.query.booking.findFirst({
    where: and(eq(booking.id, bookingId), eq(booking.agencyId, user.agencyId)),
    columns: { id: true },
  });
  if (!parent) return [];

  const rows = await db
    .select({
      commission,
      bookingRef: booking.reference,
      agentName: userTable.name,
      supplierName: supplier.name,
    })
    .from(commission)
    .leftJoin(booking, eq(booking.id, commission.bookingId))
    .leftJoin(userTable, eq(userTable.id, commission.agentUserId))
    .leftJoin(supplier, eq(supplier.id, commission.supplierId))
    .where(and(eq(commission.agencyId, user.agencyId), eq(commission.bookingId, bookingId)))
    .orderBy(desc(commission.createdAt));

  return rows.map((row) => ({
    ...row.commission,
    bookingRef: row.bookingRef,
    agentName: row.agentName,
    supplierName: row.supplierName,
  }));
}

export type CommissionSummaryRow = {
  type: string;
  currency: string;
  totalPending: number;
  totalEarned: number;
  totalPaid: number;
};

export async function getCommissionSummary(): Promise<CommissionSummaryRow[]> {
  const user = await requireAgencyUser();

  // Finance-only aggregate: agents cannot read the agency's commission totals.
  if (!canViewFinance(user.role)) return [];

  // Aggregate the ledger by type + currency, splitting the amount across the
  // three buckets the finance page cares about. "earned" rolls up everything
  // that has been realized but not necessarily settled (earned + invoiced).
  const rows = await db
    .select({
      type: commission.type,
      currency: commission.currency,
      totalPending: sql<string>`coalesce(sum(${commission.amount}) filter (where ${commission.status} = 'pending'), 0)`,
      totalEarned: sql<string>`coalesce(sum(${commission.amount}) filter (where ${commission.status} in ('earned', 'invoiced')), 0)`,
      totalPaid: sql<string>`coalesce(sum(${commission.amount}) filter (where ${commission.status} = 'paid'), 0)`,
    })
    .from(commission)
    .where(eq(commission.agencyId, user.agencyId))
    .groupBy(commission.type, commission.currency);

  return rows.map((row) => ({
    type: row.type,
    currency: row.currency,
    totalPending: parseFloat(row.totalPending),
    totalEarned: parseFloat(row.totalEarned),
    totalPaid: parseFloat(row.totalPaid),
  }));
}

// --- Auto-generation --------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Generates the commission ledger rows for a confirmed/ticketed booking.
 *
 * IDEMPOTENT: if any commission already exists for the booking, it returns
 * immediately and writes nothing. This lets the function be called safely on
 * every status transition without producing duplicates.
 *
 * Intended to be called from inside another action that has already
 * authenticated the user — it does NOT call requireAgencyUser() and instead
 * receives the agencyId to scope its queries. It never throws: any failure is
 * logged and swallowed so it can never break the caller's primary action.
 */
export async function autoGenerateCommissions(bookingId: string, agencyId: string): Promise<void> {
  try {
    // Idempotency guard: bail if this booking already has any commission rows.
    const existing = await db.query.commission.findFirst({
      where: and(eq(commission.bookingId, bookingId), eq(commission.agencyId, agencyId)),
      columns: { id: true },
    });
    if (existing) return;

    // Load the booking (scoped to its agency) together with its items and the
    // agent who owns it. The booking has no dedicated agent column — the
    // assigned agent is its creator (createdById).
    const bk = await db.query.booking.findFirst({
      where: and(eq(booking.id, bookingId), eq(booking.agencyId, agencyId)),
      columns: {
        id: true,
        currency: true,
        totalAmount: true,
        createdById: true,
      },
    });
    if (!bk) return;

    const items = await db
      .select({
        id: bookingItem.id,
        supplierId: bookingItem.supplierId,
        amount: bookingItem.amount,
        quantity: bookingItem.quantity,
      })
      .from(bookingItem)
      .where(eq(bookingItem.bookingId, bookingId));

    type CommissionInsert = typeof commission.$inferInsert;
    const rows: CommissionInsert[] = [];

    // Supplier → agency commissions: one per item that has a managed supplier
    // with an active contract carrying a commission rate.
    const supplierIds = Array.from(
      new Set(items.map((i) => i.supplierId).filter((id): id is string => !!id))
    );

    if (supplierIds.length > 0) {
      const contracts = await db
        .select({
          supplierId: supplierContract.supplierId,
          commissionRate: supplierContract.commissionRate,
          commissionBasis: supplierContract.commissionBasis,
          currency: supplierContract.currency,
        })
        .from(supplierContract)
        .where(
          and(
            eq(supplierContract.agencyId, agencyId),
            eq(supplierContract.status, "active"),
            inArray(supplierContract.supplierId, supplierIds)
          )
        );

      // Index the active contract per supplier (first wins on duplicates).
      const contractBySupplier = new Map<string, (typeof contracts)[number]>();
      for (const c of contracts) {
        if (!contractBySupplier.has(c.supplierId)) {
          contractBySupplier.set(c.supplierId, c);
        }
      }

      for (const item of items) {
        if (!item.supplierId) continue;
        const contract = contractBySupplier.get(item.supplierId);
        if (!contract || contract.commissionRate == null) continue;

        const rate = parseFloat(contract.commissionRate);
        if (!Number.isFinite(rate) || rate <= 0) continue;

        const baseAmount = round2(parseFloat(item.amount || "0") * item.quantity);
        const basis = contract.commissionBasis === "fixed" ? "fixed" : "percent";
        // Fixed-basis contracts pay a flat amount per item; percent contracts
        // pay a fraction of the line total.
        const amount = basis === "fixed" ? round2(rate) : round2((baseAmount * rate) / 100);

        rows.push({
          agencyId,
          bookingId,
          bookingItemId: item.id,
          supplierId: item.supplierId,
          type: "supplier_to_agency",
          basis,
          rate: String(rate),
          baseAmount: String(baseAmount),
          amount: String(amount),
          currency: contract.currency,
          status: "pending",
        });
      }
    }

    // Agency → agent commission: a single row for the assigned agent based on
    // their default commission rate and the booking total.
    if (bk.createdById) {
      const agent = await db.query.user.findFirst({
        where: eq(userTable.id, bk.createdById),
        columns: { id: true, commissionRatePercent: true },
      });
      if (agent?.commissionRatePercent != null) {
        const rate = parseFloat(agent.commissionRatePercent);
        if (Number.isFinite(rate) && rate > 0) {
          const baseAmount = round2(parseFloat(bk.totalAmount || "0"));
          const amount = round2((baseAmount * rate) / 100);
          rows.push({
            agencyId,
            bookingId,
            agentUserId: agent.id,
            type: "agency_to_agent",
            basis: "percent",
            rate: String(rate),
            baseAmount: String(baseAmount),
            amount: String(amount),
            currency: bk.currency,
            status: "pending",
          });
        }
      }
    }

    if (rows.length === 0) return;

    await db.insert(commission).values(rows);

    await logActivity({
      agencyId,
      userId: null,
      action: "created",
      entityType: "commission",
      entityId: bookingId,
      metadata: { autoGenerated: rows.length },
    });

    revalidatePath("/commissions");
    revalidatePath(`/bookings/${bookingId}`);
  } catch (error) {
    // Never break the caller's primary action — log and return gracefully.
    console.error("Failed to auto-generate commissions", error);
  }
}
