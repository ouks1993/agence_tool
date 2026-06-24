"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne } from "drizzle-orm";
import type { ActionResult } from "@/lib/actions/types";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { USER_ROLES, canAssignAdmin, canManageTeam } from "@/lib/domain";
import type { UserRole } from "@/lib/domain";
import { requireManager } from "@/lib/permissions";
import { user } from "@/lib/schema";

/**
 * Counts other active users who can manage the team (admin or manager).
 * Used to guard against the agency losing its last team-manager.
 */
async function countOtherActiveTeamManagers(
  agencyId: string,
  excludeUserId: string
): Promise<number> {
  return db.$count(
    user,
    and(
      eq(user.agencyId, agencyId),
      inArray(user.role, ["admin", "manager"]),
      eq(user.active, true),
      ne(user.id, excludeUserId)
    )
  );
}

export async function setUserRole(
  userId: string,
  role: UserRole
): Promise<ActionResult> {
  const me = await requireManager();
  // A real agency manager always has an agency; bail out otherwise so we never
  // run an unscoped query that could touch users in another agency.
  if (!me.agencyId) return { ok: false, error: "User not found" };
  if (!USER_ROLES.includes(role)) {
    return { ok: false, error: "Invalid role" };
  }

  // Only an admin may grant the admin role (prevents privilege escalation).
  if (role === "admin" && !canAssignAdmin(me.role)) {
    return { ok: false, error: "Only an admin can assign the admin role." };
  }

  // Scope the target lookup to the actor's agency so a manager can only act on
  // users within their own agency.
  const target = await db.query.user.findFirst({
    where: and(eq(user.id, userId), eq(user.agencyId, me.agencyId)),
  });
  if (!target) return { ok: false, error: "User not found" };

  // Only an admin may change (e.g. demote) another admin.
  if (target.role === "admin" && role !== "admin" && !canAssignAdmin(me.role)) {
    return { ok: false, error: "Only an admin can change an admin's role." };
  }

  // Don't allow removing the agency's last team-manager (admin or manager).
  if (canManageTeam(target.role as UserRole) && !canManageTeam(role)) {
    const others = await countOtherActiveTeamManagers(me.agencyId, userId);
    if (others === 0) {
      return {
        ok: false,
        error: "There must be at least one manager (admin or manager).",
      };
    }
  }

  await db
    .update(user)
    .set({ role })
    .where(and(eq(user.id, userId), eq(user.agencyId, me.agencyId)));

  await logActivity({
    agencyId: me.agencyId,
    userId: me.id,
    action: "updated",
    entityType: "user",
    entityId: userId,
    entityLabel: target.name,
    metadata: { roleChangedTo: role },
  });

  revalidatePath("/team");
  return { ok: true };
}

export async function setUserActive(
  userId: string,
  active: boolean
): Promise<ActionResult> {
  const me = await requireManager();
  // A real agency manager always has an agency; bail out otherwise so we never
  // run an unscoped query that could touch users in another agency.
  if (!me.agencyId) return { ok: false, error: "User not found" };

  if (userId === me.id && !active) {
    return { ok: false, error: "You can't deactivate yourself." };
  }

  // Scope the target lookup to the actor's agency.
  const target = await db.query.user.findFirst({
    where: and(eq(user.id, userId), eq(user.agencyId, me.agencyId)),
  });
  if (!target) return { ok: false, error: "User not found" };

  // Don't allow deactivating the last team-manager (admin or manager).
  if (canManageTeam(target.role as UserRole) && !active) {
    const others = await countOtherActiveTeamManagers(me.agencyId, userId);
    if (others === 0) {
      return {
        ok: false,
        error: "There must be at least one manager (admin or manager).",
      };
    }
  }

  await db
    .update(user)
    .set({ active })
    .where(and(eq(user.id, userId), eq(user.agencyId, me.agencyId)));

  await logActivity({
    agencyId: me.agencyId,
    userId: me.id,
    action: "updated",
    entityType: "user",
    entityId: userId,
    entityLabel: target.name,
    metadata: { active },
  });

  revalidatePath("/team");
  return { ok: true };
}
