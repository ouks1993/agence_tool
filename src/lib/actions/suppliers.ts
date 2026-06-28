"use server";

import { revalidatePath } from "next/cache";
import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import {
  canManageTeam,
  CONTRACT_BASES,
  CONTRACT_STATUSES,
  SUPPLIER_STATUSES,
  SUPPLIER_TYPES,
  SUPPORTED_CURRENCIES,
} from "@/lib/domain";
import { requireAgencyUser } from "@/lib/permissions";
import {
  bookingItem,
  supplier,
  supplierContract,
  supplierRate,
} from "@/lib/schema";

// --- Suppliers --------------------------------------------------------------

const supplierInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  type: z.enum(SUPPLIER_TYPES),
  status: z.enum(SUPPLIER_STATUSES),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional(),
  website: z.string().trim().max(300).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  contactName: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(5000).optional(),
});

export type SupplierInput = z.infer<typeof supplierInput>;

export async function createSupplier(
  input: SupplierInput
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAgencyUser();

  // Managing the supplier directory is a team-management capability.
  if (!canManageTeam(user.role)) {
    return { ok: false, error: "You don't have permission to manage suppliers" };
  }

  const parsed = supplierInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;

  try {
    const [row] = await db
      .insert(supplier)
      .values({
        agencyId: user.agencyId,
        name: d.name,
        type: d.type,
        status: d.status,
        email: d.email || null,
        phone: d.phone || null,
        website: d.website || null,
        address: d.address || null,
        city: d.city || null,
        country: d.country || null,
        contactName: d.contactName || null,
        notes: d.notes || null,
        createdById: user.id,
      })
      .returning({ id: supplier.id });

    if (!row) return { ok: false, error: "Failed to create supplier" };

    await logActivity({
      agencyId: user.agencyId,
      userId: user.id,
      action: "created",
      entityType: "supplier",
      entityId: row.id,
      entityLabel: d.name,
    });

    revalidatePath("/suppliers");
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    console.error("[createSupplier]", err);
    return { ok: false, error: "Could not create supplier. Please try again." };
  }
}

export async function updateSupplier(
  id: string,
  input: SupplierInput
): Promise<ActionResult> {
  const user = await requireAgencyUser();

  if (!canManageTeam(user.role)) {
    return { ok: false, error: "You don't have permission to manage suppliers" };
  }

  const parsed = supplierInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;

  const existing = await db.query.supplier.findFirst({
    where: and(eq(supplier.id, id), eq(supplier.agencyId, user.agencyId)),
  });
  if (!existing) return { ok: false, error: "Supplier not found" };

  try {
    await db
      .update(supplier)
      .set({
        name: d.name,
        type: d.type,
        status: d.status,
        email: d.email || null,
        phone: d.phone || null,
        website: d.website || null,
        address: d.address || null,
        city: d.city || null,
        country: d.country || null,
        contactName: d.contactName || null,
        notes: d.notes || null,
        updatedAt: new Date(),
      })
      .where(and(eq(supplier.id, id), eq(supplier.agencyId, user.agencyId)));

    await logActivity({
      agencyId: user.agencyId,
      userId: user.id,
      action: "updated",
      entityType: "supplier",
      entityId: id,
      entityLabel: d.name,
    });

    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${id}`);
    return { ok: true };
  } catch (err) {
    console.error("[updateSupplier]", err);
    return { ok: false, error: "Could not update supplier. Please try again." };
  }
}

export async function deleteSupplier(id: string): Promise<ActionResult> {
  const user = await requireAgencyUser();

  if (!canManageTeam(user.role)) {
    return { ok: false, error: "You don't have permission to manage suppliers" };
  }

  const existing = await db.query.supplier.findFirst({
    where: and(eq(supplier.id, id), eq(supplier.agencyId, user.agencyId)),
  });
  if (!existing) return { ok: false, error: "Supplier not found" };

  try {
    // Soft-delete: booking items reference suppliers, so we deactivate rather than
    // hard-delete to preserve those links (FK is set null on hard delete).
    await db
      .update(supplier)
      .set({ status: "inactive", updatedAt: new Date() })
      .where(and(eq(supplier.id, id), eq(supplier.agencyId, user.agencyId)));

    await logActivity({
      agencyId: user.agencyId,
      userId: user.id,
      action: "deleted",
      entityType: "supplier",
      entityId: id,
      entityLabel: existing.name,
    });

    revalidatePath("/suppliers");
    return { ok: true };
  } catch (err) {
    console.error("[deleteSupplier]", err);
    return { ok: false, error: "Could not delete supplier. Please try again." };
  }
}

export type SupplierFilters = {
  type?: string;
  status?: string;
  search?: string;
};

export type SupplierWithBookingCount = typeof supplier.$inferSelect & {
  bookingItemCount: number;
};

export async function getSuppliers(
  filters?: SupplierFilters
): Promise<SupplierWithBookingCount[]> {
  const user = await requireAgencyUser();

  const conditions: SQL[] = [eq(supplier.agencyId, user.agencyId)];
  if (filters?.type) conditions.push(eq(supplier.type, filters.type));
  if (filters?.status) conditions.push(eq(supplier.status, filters.status));
  if (filters?.search) {
    const term = `%${filters.search}%`;
    const match = or(
      ilike(supplier.name, term),
      ilike(supplier.city, term),
      ilike(supplier.country, term),
      ilike(supplier.contactName, term)
    );
    if (match) conditions.push(match);
  }

  // Left join + group to count linked booking items per supplier in one query.
  const rows = await db
    .select({
      supplier,
      bookingItemCount: count(bookingItem.id),
    })
    .from(supplier)
    .leftJoin(bookingItem, eq(bookingItem.supplierId, supplier.id))
    .where(and(...conditions))
    .groupBy(supplier.id)
    .orderBy(desc(supplier.createdAt));

  return rows.map((row) => ({
    ...row.supplier,
    bookingItemCount: row.bookingItemCount,
  }));
}

export type SupplierWithContracts = typeof supplier.$inferSelect & {
  contracts: (typeof supplierContract.$inferSelect & {
    rates: (typeof supplierRate.$inferSelect)[];
  })[];
};

export async function getSupplierById(
  id: string
): Promise<SupplierWithContracts | null> {
  const user = await requireAgencyUser();

  const row = await db.query.supplier.findFirst({
    where: and(eq(supplier.id, id), eq(supplier.agencyId, user.agencyId)),
  });
  if (!row) return null;

  const contracts = await db.query.supplierContract.findMany({
    where: and(
      eq(supplierContract.supplierId, id),
      eq(supplierContract.agencyId, user.agencyId)
    ),
    orderBy: desc(supplierContract.createdAt),
  });

  const contractsWithRates = await Promise.all(
    contracts.map(async (contract) => {
      const rates = await db.query.supplierRate.findMany({
        where: eq(supplierRate.contractId, contract.id),
        orderBy: desc(supplierRate.createdAt),
      });
      return { ...contract, rates };
    })
  );

  return { ...row, contracts: contractsWithRates };
}

export async function getSuppliersForPicker(): Promise<
  { id: string; name: string; type: string }[]
> {
  const user = await requireAgencyUser();

  return db
    .select({
      id: supplier.id,
      name: supplier.name,
      type: supplier.type,
    })
    .from(supplier)
    .where(
      and(eq(supplier.agencyId, user.agencyId), eq(supplier.status, "active"))
    )
    .orderBy(supplier.name);
}

// --- Supplier contracts -----------------------------------------------------

const contractInput = z.object({
  supplierId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(200),
  reference: z.string().trim().max(120).optional(),
  commissionBasis: z.enum(CONTRACT_BASES).optional(),
  commissionRate: z.number().nonnegative().optional(),
  currency: z.enum(SUPPORTED_CURRENCIES),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().optional(),
  fileUrl: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(CONTRACT_STATUSES),
  notes: z.string().trim().max(5000).optional(),
});

export type SupplierContractInput = z.infer<typeof contractInput>;

export async function createSupplierContract(
  input: SupplierContractInput
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAgencyUser();

  if (!canManageTeam(user.role)) {
    return { ok: false, error: "You don't have permission to manage suppliers" };
  }

  const parsed = contractInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;

  // Verify the parent supplier belongs to this agency before mutating its child.
  const parent = await db.query.supplier.findFirst({
    where: and(
      eq(supplier.id, d.supplierId),
      eq(supplier.agencyId, user.agencyId)
    ),
  });
  if (!parent) return { ok: false, error: "Supplier not found" };

  try {
    const [row] = await db
      .insert(supplierContract)
      .values({
        supplierId: d.supplierId,
        agencyId: user.agencyId,
        name: d.name,
        reference: d.reference || null,
        commissionBasis: d.commissionBasis || null,
        commissionRate:
          d.commissionRate != null ? String(d.commissionRate) : null,
        currency: d.currency,
        validFrom: d.validFrom ?? null,
        validTo: d.validTo ?? null,
        fileUrl: d.fileUrl || null,
        status: d.status,
        notes: d.notes || null,
      })
      .returning({ id: supplierContract.id });

    if (!row) return { ok: false, error: "Failed to create contract" };

    await logActivity({
      agencyId: user.agencyId,
      userId: user.id,
      action: "updated",
      entityType: "supplier",
      entityId: d.supplierId,
      entityLabel: parent.name,
      metadata: { contractAdded: d.name },
    });

    revalidatePath(`/suppliers/${d.supplierId}`);
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    console.error("[createSupplierContract]", err);
    return { ok: false, error: "Could not create contract. Please try again." };
  }
}

export async function updateSupplierContract(
  id: string,
  input: SupplierContractInput
): Promise<ActionResult> {
  const user = await requireAgencyUser();

  if (!canManageTeam(user.role)) {
    return { ok: false, error: "You don't have permission to manage suppliers" };
  }

  const parsed = contractInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;

  // The contract carries a denormalized agencyId; verify it belongs here.
  const existing = await db.query.supplierContract.findFirst({
    where: and(
      eq(supplierContract.id, id),
      eq(supplierContract.agencyId, user.agencyId)
    ),
  });
  if (!existing) return { ok: false, error: "Contract not found" };

  try {
    await db
      .update(supplierContract)
      .set({
        name: d.name,
        reference: d.reference || null,
        commissionBasis: d.commissionBasis || null,
        commissionRate:
          d.commissionRate != null ? String(d.commissionRate) : null,
        currency: d.currency,
        validFrom: d.validFrom ?? null,
        validTo: d.validTo ?? null,
        fileUrl: d.fileUrl || null,
        status: d.status,
        notes: d.notes || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(supplierContract.id, id),
          eq(supplierContract.agencyId, user.agencyId)
        )
      );

    await logActivity({
      agencyId: user.agencyId,
      userId: user.id,
      action: "updated",
      entityType: "supplier",
      entityId: existing.supplierId,
      entityLabel: d.name,
      metadata: { contractUpdated: d.name },
    });

    revalidatePath(`/suppliers/${existing.supplierId}`);
    return { ok: true };
  } catch (err) {
    console.error("[updateSupplierContract]", err);
    return { ok: false, error: "Could not update contract. Please try again." };
  }
}

export async function deleteSupplierContract(
  id: string
): Promise<ActionResult> {
  const user = await requireAgencyUser();

  if (!canManageTeam(user.role)) {
    return { ok: false, error: "You don't have permission to manage suppliers" };
  }

  const existing = await db.query.supplierContract.findFirst({
    where: and(
      eq(supplierContract.id, id),
      eq(supplierContract.agencyId, user.agencyId)
    ),
  });
  if (!existing) return { ok: false, error: "Contract not found" };

  try {
    // Hard delete — rates cascade away with the contract (FK onDelete cascade).
    await db
      .delete(supplierContract)
      .where(
        and(
          eq(supplierContract.id, id),
          eq(supplierContract.agencyId, user.agencyId)
        )
      );

    await logActivity({
      agencyId: user.agencyId,
      userId: user.id,
      action: "updated",
      entityType: "supplier",
      entityId: existing.supplierId,
      entityLabel: existing.name,
      metadata: { contractDeleted: existing.name },
    });

    revalidatePath(`/suppliers/${existing.supplierId}`);
    return { ok: true };
  } catch (err) {
    console.error("[deleteSupplierContract]", err);
    return { ok: false, error: "Could not delete contract. Please try again." };
  }
}

export async function getSupplierContracts(
  supplierId: string
): Promise<
  (typeof supplierContract.$inferSelect & {
    rates: (typeof supplierRate.$inferSelect)[];
  })[]
> {
  const user = await requireAgencyUser();

  // Scope through the denormalized agencyId so we never leak other tenants.
  const contracts = await db.query.supplierContract.findMany({
    where: and(
      eq(supplierContract.supplierId, supplierId),
      eq(supplierContract.agencyId, user.agencyId)
    ),
    orderBy: desc(supplierContract.createdAt),
  });

  return Promise.all(
    contracts.map(async (contract) => {
      const rates = await db.query.supplierRate.findMany({
        where: eq(supplierRate.contractId, contract.id),
        orderBy: desc(supplierRate.createdAt),
      });
      return { ...contract, rates };
    })
  );
}

// --- Supplier rates ---------------------------------------------------------

const rateInput = z.object({
  contractId: z.string().min(1),
  description: z.string().trim().min(1, "Description is required").max(300),
  netRate: z.number().nonnegative().optional(),
  sellRate: z.number().nonnegative().optional(),
  currency: z.enum(SUPPORTED_CURRENCIES),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().optional(),
});

export type SupplierRateInput = z.infer<typeof rateInput>;

/** Verifies a contract belongs to this agency and returns its supplierId. */
async function assertContractOwnership(
  contractId: string,
  agencyId: string
): Promise<{ supplierId: string } | null> {
  const contract = await db.query.supplierContract.findFirst({
    where: and(
      eq(supplierContract.id, contractId),
      eq(supplierContract.agencyId, agencyId)
    ),
    columns: { supplierId: true },
  });
  return contract ?? null;
}

export async function createSupplierRate(
  input: SupplierRateInput
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAgencyUser();

  if (!canManageTeam(user.role)) {
    return { ok: false, error: "You don't have permission to manage suppliers" };
  }

  const parsed = rateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;

  const contract = await assertContractOwnership(d.contractId, user.agencyId);
  if (!contract) return { ok: false, error: "Contract not found" };

  try {
    const [row] = await db
      .insert(supplierRate)
      .values({
        contractId: d.contractId,
        description: d.description,
        netRate: d.netRate != null ? String(d.netRate) : null,
        sellRate: d.sellRate != null ? String(d.sellRate) : null,
        currency: d.currency,
        validFrom: d.validFrom ?? null,
        validTo: d.validTo ?? null,
      })
      .returning({ id: supplierRate.id });

    if (!row) return { ok: false, error: "Failed to create rate" };

    revalidatePath(`/suppliers/${contract.supplierId}`);
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    console.error("[createSupplierRate]", err);
    return { ok: false, error: "Could not create rate. Please try again." };
  }
}

export async function updateSupplierRate(
  id: string,
  input: SupplierRateInput
): Promise<ActionResult> {
  const user = await requireAgencyUser();

  if (!canManageTeam(user.role)) {
    return { ok: false, error: "You don't have permission to manage suppliers" };
  }

  const parsed = rateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;

  // Ownership flows through the rate's parent contract's agencyId.
  const contract = await assertContractOwnership(d.contractId, user.agencyId);
  if (!contract) return { ok: false, error: "Contract not found" };

  try {
    await db
      .update(supplierRate)
      .set({
        description: d.description,
        netRate: d.netRate != null ? String(d.netRate) : null,
        sellRate: d.sellRate != null ? String(d.sellRate) : null,
        currency: d.currency,
        validFrom: d.validFrom ?? null,
        validTo: d.validTo ?? null,
      })
      .where(
        and(
          eq(supplierRate.id, id),
          eq(supplierRate.contractId, d.contractId)
        )
      );

    revalidatePath(`/suppliers/${contract.supplierId}`);
    return { ok: true };
  } catch (err) {
    console.error("[updateSupplierRate]", err);
    return { ok: false, error: "Could not update rate. Please try again." };
  }
}

export async function deleteSupplierRate(id: string): Promise<ActionResult> {
  const user = await requireAgencyUser();

  if (!canManageTeam(user.role)) {
    return { ok: false, error: "You don't have permission to manage suppliers" };
  }

  // The rate has no agencyId of its own; verify ownership through its contract.
  const existing = await db.query.supplierRate.findFirst({
    where: eq(supplierRate.id, id),
    columns: { id: true, contractId: true },
  });
  if (!existing) return { ok: false, error: "Rate not found" };

  const contract = await assertContractOwnership(
    existing.contractId,
    user.agencyId
  );
  if (!contract) return { ok: false, error: "Rate not found" };

  try {
    await db.delete(supplierRate).where(eq(supplierRate.id, id));

    revalidatePath(`/suppliers/${contract.supplierId}`);
    return { ok: true };
  } catch (err) {
    console.error("[deleteSupplierRate]", err);
    return { ok: false, error: "Could not delete rate. Please try again." };
  }
}
