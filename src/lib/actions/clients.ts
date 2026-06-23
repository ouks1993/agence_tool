"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/permissions";
import { client, clientContact } from "@/lib/schema";

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
  source: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(5000).optional(),
  ownerId: z.string().trim().optional(),
});

export type ClientInput = z.infer<typeof clientInput>;

export async function createClient(
  input: ClientInput
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = clientInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;

  const [row] = await db
    .insert(client)
    .values({
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
      notes: d.notes || null,
      ownerId: d.ownerId || user.id,
      createdById: user.id,
    })
    .returning({ id: client.id });

  if (!row) return { ok: false, error: "Failed to create client" };

  await logActivity({
    userId: user.id,
    action: "created",
    entityType: "client",
    entityId: row.id,
    entityLabel: d.name,
  });

  revalidatePath("/clients");
  return { ok: true, data: { id: row.id } };
}

export async function updateClient(
  id: string,
  input: ClientInput
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = clientInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;

  const existing = await db.query.client.findFirst({ where: eq(client.id, id) });
  if (!existing) return { ok: false, error: "Client not found" };

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
      notes: d.notes || null,
      ownerId: d.ownerId || null,
    })
    .where(eq(client.id, id));

  await logActivity({
    userId: user.id,
    action: "updated",
    entityType: "client",
    entityId: id,
    entityLabel: d.name,
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true };
}

export async function deleteClient(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await db.query.client.findFirst({ where: eq(client.id, id) });
  if (!existing) return { ok: false, error: "Client not found" };

  // Only a manager or the owner/creator may delete a client.
  if (
    user.role !== "manager" &&
    existing.ownerId !== user.id &&
    existing.createdById !== user.id
  ) {
    return { ok: false, error: "You don't have permission to delete this client" };
  }

  await db.delete(client).where(eq(client.id, id));

  await logActivity({
    userId: user.id,
    action: "deleted",
    entityType: "client",
    entityId: id,
    entityLabel: existing.name,
  });

  revalidatePath("/clients");
  return { ok: true };
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
  const user = await requireUser();
  const parsed = contactInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;

  await db.insert(clientContact).values({
    clientId: d.clientId,
    name: d.name,
    jobTitle: d.jobTitle || null,
    email: d.email || null,
    phone: d.phone || null,
    isPrimary: d.isPrimary ?? false,
  });

  await logActivity({
    userId: user.id,
    action: "updated",
    entityType: "client",
    entityId: d.clientId,
    entityLabel: d.name,
    metadata: { contactAdded: d.name },
  });

  revalidatePath(`/clients/${d.clientId}`);
  return { ok: true };
}

export async function deleteContact(
  contactId: string,
  clientId: string
): Promise<ActionResult> {
  await requireUser();
  await db
    .delete(clientContact)
    .where(and(eq(clientContact.id, contactId), eq(clientContact.clientId, clientId)));
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}
