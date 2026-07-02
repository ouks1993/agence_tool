"use server";

import { and, count, desc, eq, isNull } from "drizzle-orm";
import type { ActionResult } from "@/lib/actions/types";
import { db } from "@/lib/db";
import { requireAgencyUser } from "@/lib/permissions";
import { userNotification } from "@/lib/schema";

/**
 * Server actions for the per-user in-app notification inbox (topbar bell).
 *
 * Every query is DOUBLE-scoped — by the recipient (`userId`) AND the tenant
 * (`agencyId`) — so a user can only ever read/mutate their own notifications
 * within their own agency.
 */

/** A single inbox row shaped for the client bell (dates serialized as-is). */
export type InboxNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export type InboxSnapshot = {
  items: InboxNotification[];
  unreadCount: number;
};

/** How many notifications the bell dropdown shows. */
const INBOX_LIMIT = 15;

/**
 * Latest notifications for the current user plus the count of unread ones.
 * Two parallel queries (list + count) in a single round trip.
 */
export async function getMyNotifications(): Promise<InboxSnapshot> {
  const user = await requireAgencyUser();

  const [items, unread] = await Promise.all([
    db
      .select({
        id: userNotification.id,
        type: userNotification.type,
        title: userNotification.title,
        body: userNotification.body,
        href: userNotification.href,
        readAt: userNotification.readAt,
        createdAt: userNotification.createdAt,
      })
      .from(userNotification)
      .where(
        and(
          eq(userNotification.userId, user.id),
          eq(userNotification.agencyId, user.agencyId)
        )
      )
      .orderBy(desc(userNotification.createdAt))
      .limit(INBOX_LIMIT),
    db
      .select({ n: count() })
      .from(userNotification)
      .where(
        and(
          eq(userNotification.userId, user.id),
          eq(userNotification.agencyId, user.agencyId),
          isNull(userNotification.readAt)
        )
      ),
  ]);

  return { items, unreadCount: unread[0]?.n ?? 0 };
}

/** Marks a single notification read (scoped to the current user + agency). */
export async function markNotificationRead(id: string): Promise<ActionResult> {
  const user = await requireAgencyUser();
  if (!id) return { ok: false, error: "Invalid notification." };

  try {
    await db
      .update(userNotification)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(userNotification.id, id),
          eq(userNotification.userId, user.id),
          eq(userNotification.agencyId, user.agencyId),
          isNull(userNotification.readAt)
        )
      );
    return { ok: true };
  } catch (err) {
    console.error("[markNotificationRead]", err);
    return { ok: false, error: "Could not update the notification." };
  }
}

/** Marks all of the current user's unread notifications read. */
export async function markAllNotificationsRead(): Promise<ActionResult> {
  const user = await requireAgencyUser();

  try {
    await db
      .update(userNotification)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(userNotification.userId, user.id),
          eq(userNotification.agencyId, user.agencyId),
          isNull(userNotification.readAt)
        )
      );
    return { ok: true };
  } catch (err) {
    console.error("[markAllNotificationsRead]", err);
    return { ok: false, error: "Could not update the notifications." };
  }
}
