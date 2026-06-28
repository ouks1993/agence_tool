"use server";

import { eq } from "drizzle-orm";
import type { ActionResult } from "@/lib/actions/types";
import { db } from "@/lib/db";
import { requireAgencyUser } from "@/lib/permissions";
import { agency } from "@/lib/schema";

/** Mark the getting-started checklist as dismissed for this agency. */
export async function dismissOnboarding(): Promise<ActionResult> {
  const user = await requireAgencyUser();
  try {
    await db
      .update(agency)
      .set({ onboardingDismissedAt: new Date() })
      .where(eq(agency.id, user.agencyId));
    return { ok: true };
  } catch (err) {
    console.error("[dismissOnboarding]", err);
    return { ok: false, error: "Could not update onboarding. Please try again." };
  }
}
