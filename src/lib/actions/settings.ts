"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";
import type { ActionResult } from "@/lib/actions/types";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/permissions";
import { user } from "@/lib/schema";

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
