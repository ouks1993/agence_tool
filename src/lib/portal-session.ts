/**
 * Traveler Portal session helpers.
 *
 * A passwordless, client-facing session system entirely separate from the
 * BetterAuth (staff) auth. The session token lives in an httpOnly cookie and
 * points at a `portal_session` row scoped to one client. Used by the server
 * components and route handlers under `/portal`.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { portalSession } from "@/lib/schema";

const COOKIE_NAME = "portalSessionToken";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/**
 * Returns the active portal session (with its client) for the current cookie,
 * or null if there is no cookie or the session is missing/expired.
 */
export async function getPortalSession() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const row = await db.query.portalSession.findFirst({
    where: and(
      eq(portalSession.token, token),
      gt(portalSession.expiresAt, new Date())
    ),
    with: {
      client: {
        columns: { id: true, name: true, email: true, agencyId: true },
      },
    },
  });

  return row ?? null;
}

/**
 * Like `getPortalSession`, but redirects to the portal login page when there
 * is no valid session. Use in protected server components.
 */
export async function requirePortalSession() {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");
  return session;
}

/** Removes the session cookie from the browser (does not touch the DB row). */
export async function clearPortalSession() {
  (await cookies()).delete(COOKIE_NAME);
}

export { COOKIE_NAME, COOKIE_OPTIONS };
