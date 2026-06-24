"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import type { ActionResult } from "@/lib/actions/types";
import { db } from "@/lib/db";
import { createInvite } from "@/lib/invites";
import { requirePlatformAdmin } from "@/lib/permissions";
import { agency, user } from "@/lib/schema";

/** A basic email shape check — good enough to reject obvious typos at the boundary. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Result of {@link createAgency}. Extends the standard ActionResult shape with the
 * first admin's invite token so the UI can render a copyable invite link (there is
 * no email integration yet, so the platform admin shares the link manually).
 */
export type CreateAgencyResult = {
  ok: boolean;
  error?: string;
  inviteToken?: string;
};

/**
 * Turns an agency name into a URL-safe slug: lowercased, spaces collapsed to "-",
 * and anything that isn't an alphanumeric or dash stripped. May return "" for input
 * with no usable characters (caller handles the fallback).
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // drop disallowed characters
    .replace(/[\s-]+/g, "-") // collapse whitespace/dashes into a single dash
    .replace(/^-+|-+$/g, ""); // trim leading/trailing dashes
}

/**
 * Finds a slug that is not yet taken. If the base slug collides, appends a numeric
 * suffix ("-2", "-3", …) until a free one is found. Deterministic — no randomness.
 */
async function uniqueSlug(base: string): Promise<string> {
  const candidate = base || "agency";
  let slug = candidate;
  let suffix = 1;

  // Loop until we find a slug with no existing agency. Bounded in practice by the
  // number of agencies sharing the same base name.
  for (;;) {
    const existing = await db.query.agency.findFirst({
      where: eq(agency.slug, slug),
      columns: { id: true },
    });
    if (!existing) return slug;
    suffix += 1;
    slug = `${candidate}-${suffix}`;
  }
}

/**
 * Provisions a new agency (tenant) and invites its first admin.
 *
 * Steps: validate the name + admin email, reject if a user already exists for that
 * email, derive a unique slug, INSERT the agency (status "active"), then create a
 * pending admin invite. Returns the invite token so the console can show the link.
 */
export async function createAgency(input: {
  name: string;
  adminName?: string;
  adminEmail: string;
}): Promise<CreateAgencyResult> {
  const me = await requirePlatformAdmin();

  const name = input.name?.trim() ?? "";
  const adminEmail = input.adminEmail?.trim().toLowerCase() ?? "";

  if (!name) {
    return { ok: false, error: "Agency name is required." };
  }
  if (!adminEmail || !EMAIL_RE.test(adminEmail)) {
    return { ok: false, error: "A valid admin email is required." };
  }

  // Registration is invitation-only and an email maps to exactly one account, so a
  // pre-existing user cannot be the fresh admin of a brand-new agency.
  const existingUser = await db.query.user.findFirst({
    where: eq(user.email, adminEmail),
    columns: { id: true },
  });
  if (existingUser) {
    return { ok: false, error: "That email already has an account." };
  }

  const slug = await uniqueSlug(slugify(name));

  const [newAgency] = await db
    .insert(agency)
    .values({ name, slug, status: "active" })
    .returning();

  if (!newAgency) {
    return { ok: false, error: "Failed to create the agency." };
  }

  // Invite the agency's first admin. The token is surfaced to the platform admin so
  // they can hand the setup link to the new agency owner.
  const invite = await createInvite({
    agencyId: newAgency.id,
    email: adminEmail,
    role: "admin",
    invitedById: me.id,
  });

  revalidatePath("/platform");
  return { ok: true, inviteToken: invite.token };
}

/**
 * Suspends an agency. Its users are then locked out automatically by
 * requireAgencyUser (which rejects non-active agencies).
 */
export async function suspendAgency(agencyId: string): Promise<ActionResult> {
  await requirePlatformAdmin();

  await db
    .update(agency)
    .set({ status: "suspended" })
    .where(eq(agency.id, agencyId));

  revalidatePath("/platform");
  revalidatePath(`/platform/agencies/${agencyId}`);
  return { ok: true };
}

/** Reactivates a suspended agency, restoring access for its users. */
export async function reactivateAgency(agencyId: string): Promise<ActionResult> {
  await requirePlatformAdmin();

  await db
    .update(agency)
    .set({ status: "active" })
    .where(eq(agency.id, agencyId));

  revalidatePath("/platform");
  revalidatePath(`/platform/agencies/${agencyId}`);
  return { ok: true };
}
