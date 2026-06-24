import { randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { USER_ROLES, type UserRole } from "@/lib/domain";
import { agencyInvite } from "@/lib/schema";

/** Days a fresh invite stays valid. */
const INVITE_TTL_DAYS = 7;

/** Generates an unguessable, URL-safe invite token. */
export function generateInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export type InviteRecord = typeof agencyInvite.$inferSelect;

/**
 * Creates a pending invite and returns it (including the token). Caller is
 * responsible for authorization (which agency, who may invite which role).
 */
export async function createInvite(params: {
  agencyId: string;
  email: string;
  role: UserRole;
  invitedById: string | null;
}): Promise<InviteRecord> {
  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const [row] = await db
    .insert(agencyInvite)
    .values({
      agencyId: params.agencyId,
      email: params.email.trim().toLowerCase(),
      role: params.role,
      token,
      invitedById: params.invitedById,
      expiresAt,
    })
    .returning();
  if (!row) throw new Error("Failed to create invite");
  return row;
}

/**
 * Finds a still-valid pending invite for an email. Used by the auth signup
 * hook to gate registration and stamp agencyId + role on the new user.
 */
export async function findPendingInviteByEmail(
  email: string
): Promise<InviteRecord | undefined> {
  return db.query.agencyInvite.findFirst({
    where: and(
      eq(agencyInvite.email, email.trim().toLowerCase()),
      eq(agencyInvite.status, "pending"),
      gt(agencyInvite.expiresAt, new Date())
    ),
  });
}

/** Looks up a pending, unexpired invite by its token (for the accept page). */
export async function findPendingInviteByToken(
  token: string
): Promise<InviteRecord | undefined> {
  return db.query.agencyInvite.findFirst({
    where: and(
      eq(agencyInvite.token, token),
      eq(agencyInvite.status, "pending"),
      gt(agencyInvite.expiresAt, new Date())
    ),
  });
}

/** Marks the pending invite(s) for an email as accepted. Called after signup. */
export async function markInviteAccepted(email: string): Promise<void> {
  await db
    .update(agencyInvite)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(
      and(
        eq(agencyInvite.email, email.trim().toLowerCase()),
        eq(agencyInvite.status, "pending")
      )
    );
}

/** Normalizes/validates a role string from user input. */
export function isAssignableRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}
