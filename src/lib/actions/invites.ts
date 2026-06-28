"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import type { ActionResult } from "@/lib/actions/types";
import { db } from "@/lib/db";
import { canAssignAdmin, USER_ROLE_META, type UserRole } from "@/lib/domain";
import { createInvite, isAssignableRole } from "@/lib/invites";
import { sendEmail } from "@/lib/notifications/email";
import { inviteEmailHtml } from "@/lib/notifications/templates";
import { requireManager } from "@/lib/permissions";
import { agency, agencyInvite, notification, user } from "@/lib/schema";

/** Canonical app URL for building links inside server-sent emails. */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** Basic email shape check (a single @ with text either side and a dotted host). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invites a new team member to the current admin/manager's agency.
 * Registration is invitation-only, so this is the only way to add a member.
 */
export async function inviteTeamMember(
  email: string,
  role: string
): Promise<ActionResult> {
  const me = await requireManager();
  // A real agency manager always has an agency; bail out otherwise so we never
  // create an invite that isn't scoped to a tenant.
  if (!me.agencyId) {
    return { ok: false, error: "Your account isn't linked to an agency." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  if (!isAssignableRole(role)) {
    return { ok: false, error: "Invalid role." };
  }

  // Only an admin may grant the admin role (prevents privilege escalation).
  if (role === "admin" && !canAssignAdmin(me.role)) {
    return { ok: false, error: "Only an admin can invite an admin." };
  }

  // Reject if a user with that email already exists anywhere in the system
  // (emails are globally unique on the user table).
  const existingUser = await db.query.user.findFirst({
    where: eq(user.email, normalizedEmail),
    columns: { id: true },
  });
  if (existingUser) {
    return { ok: false, error: "A user with that email already exists." };
  }

  // Reject a duplicate pending invite for the same email within this agency.
  const existingInvite = await db.query.agencyInvite.findFirst({
    where: and(
      eq(agencyInvite.agencyId, me.agencyId),
      eq(agencyInvite.email, normalizedEmail),
      eq(agencyInvite.status, "pending")
    ),
    columns: { id: true },
  });
  if (existingInvite) {
    return { ok: false, error: "This email already has a pending invite." };
  }

  try {
    const invite = await createInvite({
      agencyId: me.agencyId,
      email: normalizedEmail,
      role,
      invitedById: me.id,
    });

    // Send the invite email (best-effort): build the accept link from the
    // configured app URL, send a branded message, and record the attempt in the
    // notification log. A delivery failure never fails the invite — the link can
    // still be copied from the team page.
    const agencyRow = await db.query.agency.findFirst({
      where: eq(agency.id, me.agencyId),
      columns: { name: true },
    });
    const agencyName = agencyRow?.name ?? "your agency";
    const roleLabel = USER_ROLE_META[role as UserRole]?.label ?? role;
    const acceptUrl = `${APP_URL}/invite/${invite.token}`;
    const subject = `You're invited to ${agencyName} on Atlas`;
    const text = `You've been invited to join ${agencyName} on Atlas as ${roleLabel}.\n\nAccept your invite:\n${acceptUrl}\n\nThis invite expires in 7 days.`;

    const result = await sendEmail({
      to: normalizedEmail,
      subject,
      text,
      html: inviteEmailHtml({ agencyName, roleLabel, url: acceptUrl }),
    });

    await db.insert(notification).values({
      agencyId: me.agencyId,
      channel: "email",
      recipient: normalizedEmail,
      subject,
      body: text,
      kind: "invite",
      status: result.status,
      error: result.error ?? null,
      createdById: me.id,
    });

    revalidatePath("/team");
    return { ok: true };
  } catch (err) {
    console.error("[inviteTeamMember]", err);
    return { ok: false, error: "Could not send the invite. Please try again." };
  }
}

/**
 * Revokes a pending invite. Agency-scoped: a manager can only revoke invites
 * belonging to their own agency, and only while still pending.
 */
export async function revokeInvite(inviteId: string): Promise<ActionResult> {
  const me = await requireManager();
  if (!me.agencyId) {
    return { ok: false, error: "Your account isn't linked to an agency." };
  }

  try {
    await db
      .update(agencyInvite)
      .set({ status: "revoked" })
      .where(
        and(
          eq(agencyInvite.id, inviteId),
          eq(agencyInvite.agencyId, me.agencyId),
          eq(agencyInvite.status, "pending")
        )
      );

    revalidatePath("/team");
    return { ok: true };
  } catch (err) {
    console.error("[revokeInvite]", err);
    return { ok: false, error: "Could not revoke the invite. Please try again." };
  }
}
