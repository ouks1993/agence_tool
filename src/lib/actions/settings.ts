"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";
import type { ActionResult } from "@/lib/actions/types";
import { db } from "@/lib/db";
import { canManageTeam } from "@/lib/domain";
import { requireAgencyUser, requireUser } from "@/lib/permissions";
import { agency, user } from "@/lib/schema";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Sets the UI language: writes the `locale` cookie (read by the i18n request
 * config) and persists the choice to the user's account. The caller refreshes
 * the page so the new locale takes effect.
 */
export async function setLocale(locale: string): Promise<ActionResult> {
  if (!isLocale(locale)) return { ok: false, error: "Unsupported language." };

  (await cookies()).set(LOCALE_COOKIE, locale, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });

  // Best-effort persistence to the account (survives across devices on re-pick).
  try {
    const me = await requireUser();
    await db.update(user).set({ locale }).where(eq(user.id, me.id));
  } catch {
    // not signed in — cookie alone is enough
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * After a successful login, copies the user's stored account locale into the
 * `locale` cookie so a fresh device inherits their chosen language without
 * having to visit Settings. Best-effort and fire-and-forget: any failure is
 * swallowed so it can never block the sign-in flow.
 */
export async function syncLocaleAfterLogin(): Promise<void> {
  try {
    const me = await requireUser();
    const row = await db.query.user.findFirst({
      where: eq(user.id, me.id),
      columns: { locale: true },
    });

    if (!isLocale(row?.locale)) return;

    (await cookies()).set(LOCALE_COOKIE, row.locale, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ONE_YEAR,
    });
  } catch {
    // Not signed in or DB hiccup — the cookie/default locale still applies.
  }
}

/** Updates the signed-in user's display name. */
export async function updateProfile(input: { name: string }): Promise<ActionResult> {
  const me = await requireUser();
  const name = input.name?.trim() ?? "";
  if (name.length < 2) return { ok: false, error: "Name is too short." };
  if (name.length > 120) return { ok: false, error: "Name is too long." };

  await db.update(user).set({ name }).where(eq(user.id, me.id));
  revalidatePath("/settings");
  return { ok: true };
}

// Deposit percentage: 0–100, up to 2dp — matches the numeric(5,2) column and
// the [0,100] clamp the lifecycle/proposal helpers already apply defensively.
const depositPercentInput = z.object({
  depositPercent: z
    .number()
    .finite()
    .min(0, "Deposit must be at least 0%.")
    .max(100, "Deposit cannot exceed 100%."),
});

export type DepositPercentInput = z.input<typeof depositPercentInput>;

/**
 * Updates the agency's deposit percentage (the share of a booking total that
 * secures the dates / unlocks `confirmed`). Admin/manager only — mirrors how the
 * team-management agency settings are gated. Scoped to the caller's own agency.
 */
export async function updateAgencyDepositPercent(
  input: DepositPercentInput
): Promise<ActionResult> {
  const me = await requireAgencyUser();
  if (!canManageTeam(me.role)) {
    return { ok: false, error: "You don't have permission to change this." };
  }

  const parsed = depositPercentInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid deposit percentage.",
    };
  }

  // Persist as a 2dp numeric string, matching the column and other money/percent
  // columns written across the app.
  const value = (Math.round(parsed.data.depositPercent * 100) / 100).toFixed(2);
  await db
    .update(agency)
    .set({ depositPercent: value })
    .where(eq(agency.id, me.agencyId));

  revalidatePath("/settings");
  return { ok: true };
}
