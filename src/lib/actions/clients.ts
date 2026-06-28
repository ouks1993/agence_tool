"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { canDeleteRecords, INDUSTRIES, LEAD_SOURCES } from "@/lib/domain";
import { requireAgencyUser } from "@/lib/permissions";
import { client, clientContact } from "@/lib/schema";

// Accepts a controlled code, "" or undefined → normalized to null on write.
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional().or(z.literal(""));

const clientInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  type: z.enum(["individual", "corporate"]),
  status: z.enum(["lead", "active", "inactive"]),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional(),
  company: z.string().trim().max(200).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  source: optionalEnum(LEAD_SOURCES),
  industry: optionalEnum(INDUSTRIES),
  notes: z.string().trim().max(5000).optional(),
  ownerId: z.string().trim().optional(),
});

export type ClientInput = z.infer<typeof clientInput>;

export async function createClient(
  input: ClientInput
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAgencyUser();
  const parsed = clientInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;

  try {
    const [row] = await db
      .insert(client)
      .values({
        agencyId: user.agencyId,
        name: d.name,
        type: d.type,
        status: d.status,
        email: d.email || null,
        phone: d.phone || null,
        company: d.company || null,
        address: d.address || null,
        city: d.city || null,
        country: d.country || null,
        source: d.source || null,
        industry: d.industry || null,
        notes: d.notes || null,
        ownerId: d.ownerId || user.id,
        createdById: user.id,
      })
      .returning({ id: client.id });

    if (!row) return { ok: false, error: "Failed to create client" };

    await logActivity({
      agencyId: user.agencyId,
      userId: user.id,
      action: "created",
      entityType: "client",
      entityId: row.id,
      entityLabel: d.name,
    });

    revalidatePath("/clients");
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    console.error("[createClient]", err);
    return { ok: false, error: "Could not create client. Please try again." };
  }
}

export async function updateClient(
  id: string,
  input: ClientInput
): Promise<ActionResult> {
  const user = await requireAgencyUser();
  const parsed = clientInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;

  const existing = await db.query.client.findFirst({
    where: and(eq(client.id, id), eq(client.agencyId, user.agencyId)),
  });
  if (!existing) return { ok: false, error: "Client not found" };

  try {
    await db
      .update(client)
      .set({
        name: d.name,
        type: d.type,
        status: d.status,
        email: d.email || null,
        phone: d.phone || null,
        company: d.company || null,
        address: d.address || null,
        city: d.city || null,
        country: d.country || null,
        source: d.source || null,
        industry: d.industry || null,
        notes: d.notes || null,
        ownerId: d.ownerId || null,
      })
      .where(and(eq(client.id, id), eq(client.agencyId, user.agencyId)));

    await logActivity({
      agencyId: user.agencyId,
      userId: user.id,
      action: "updated",
      entityType: "client",
      entityId: id,
      entityLabel: d.name,
    });

    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    return { ok: true };
  } catch (err) {
    console.error("[updateClient]", err);
    return { ok: false, error: "Could not update client. Please try again." };
  }
}

export async function deleteClient(id: string): Promise<ActionResult> {
  const user = await requireAgencyUser();
  const existing = await db.query.client.findFirst({
    where: and(eq(client.id, id), eq(client.agencyId, user.agencyId)),
  });
  if (!existing) return { ok: false, error: "Client not found" };

  // Only a privileged role or the owner/creator may delete a client.
  if (
    !canDeleteRecords(user.role) &&
    existing.ownerId !== user.id &&
    existing.createdById !== user.id
  ) {
    return { ok: false, error: "You don't have permission to delete this client" };
  }

  try {
    await db
      .delete(client)
      .where(and(eq(client.id, id), eq(client.agencyId, user.agencyId)));

    await logActivity({
      agencyId: user.agencyId,
      userId: user.id,
      action: "deleted",
      entityType: "client",
      entityId: id,
      entityLabel: existing.name,
    });

    revalidatePath("/clients");
    return { ok: true };
  } catch (err) {
    console.error("[deleteClient]", err);
    return { ok: false, error: "Could not delete client. Please try again." };
  }
}

// --- Contacts ---------------------------------------------------------------

const contactInput = z.object({
  clientId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(200),
  jobTitle: z.string().trim().max(120).optional(),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional(),
  isPrimary: z.boolean().optional(),
});

export async function addContact(
  input: z.infer<typeof contactInput>
): Promise<ActionResult> {
  const user = await requireAgencyUser();
  const parsed = contactInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;

  // Verify the parent client belongs to this agency before mutating its child.
  const parent = await db.query.client.findFirst({
    where: and(eq(client.id, d.clientId), eq(client.agencyId, user.agencyId)),
  });
  if (!parent) return { ok: false, error: "Not found" };

  try {
    await db.insert(clientContact).values({
      clientId: d.clientId,
      name: d.name,
      jobTitle: d.jobTitle || null,
      email: d.email || null,
      phone: d.phone || null,
      isPrimary: d.isPrimary ?? false,
    });

    await logActivity({
      agencyId: user.agencyId,
      userId: user.id,
      action: "updated",
      entityType: "client",
      entityId: d.clientId,
      entityLabel: d.name,
      metadata: { contactAdded: d.name },
    });

    revalidatePath(`/clients/${d.clientId}`);
    return { ok: true };
  } catch (err) {
    console.error("[addContact]", err);
    return { ok: false, error: "Could not add contact. Please try again." };
  }
}

export async function deleteContact(
  contactId: string,
  clientId: string
): Promise<ActionResult> {
  const user = await requireAgencyUser();

  // The contact has no agencyId of its own; verify its parent client belongs
  // to this agency before deleting it.
  const parent = await db.query.client.findFirst({
    where: and(eq(client.id, clientId), eq(client.agencyId, user.agencyId)),
  });
  if (!parent) return { ok: false, error: "Not found" };

  try {
    await db
      .delete(clientContact)
      .where(and(eq(clientContact.id, contactId), eq(clientContact.clientId, clientId)));
    revalidatePath(`/clients/${clientId}`);
    return { ok: true };
  } catch (err) {
    console.error("[deleteContact]", err);
    return { ok: false, error: "Could not delete contact. Please try again." };
  }
}
