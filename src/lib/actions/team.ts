"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import type { ActionResult } from "@/lib/actions/types";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/permissions";
import { user } from "@/lib/schema";

async function countOtherActiveManagers(excludeUserId: string): Promise<number> {
  return db.$count(
    user,
    and(eq(user.role, "manager"), eq(user.active, true), ne(user.id, excludeUserId))
  );
}

export async function setUserRole(
  userId: string,
  role: "manager" | "agent"
): Promise<ActionResult> {
  const me = await requireManager();
  if (role !== "manager" && role !== "agent") {
    return { ok: false, error: "Invalid role" };
  }

  const target = await db.query.user.findFirst({ where: eq(user.id, userId) });
  if (!target) return { ok: false, error: "User not found" };

  // Don't allow removing the last manager.
  if (target.role === "manager" && role === "agent") {
    const others = await countOtherActiveManagers(userId);
    if (others === 0) {
      return { ok: false, error: "There must be at least one manager." };
    }
  }

  await db.update(user).set({ role }).where(eq(user.id, userId));

  await logActivity({
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

  if (userId === me.id && !active) {
    return { ok: false, error: "You can't deactivate yourself." };
  }

  const target = await db.query.user.findFirst({ where: eq(user.id, userId) });
  if (!target) return { ok: false, error: "User not found" };

  // Don't allow deactivating the last manager.
  if (target.role === "manager" && !active) {
    const others = await countOtherActiveManagers(userId);
    if (others === 0) {
      return { ok: false, error: "There must be at least one active manager." };
    }
  }

  await db.update(user).set({ active }).where(eq(user.id, userId));

  await logActivity({
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
