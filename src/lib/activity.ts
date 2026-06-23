import { db } from "@/lib/db";
import { activityLog } from "@/lib/schema";

type LogActivityInput = {
  userId: string | null;
  action: string;
  entityType: "client" | "opportunity" | "product" | "booking" | "user";
  entityId?: string | null;
  entityLabel?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Records an action in the activity log so managers can see what the team did.
 * Failures are swallowed — logging must never break the user's actual action.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await db.insert(activityLog).values({
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      entityLabel: input.entityLabel ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (error) {
     
    console.error("Failed to write activity log", error);
  }
}
