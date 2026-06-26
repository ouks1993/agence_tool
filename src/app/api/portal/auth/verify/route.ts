/**
 * GET /api/portal/auth/verify?token=...
 *
 * Consumes a magic-link token: if it is valid and unexpired, the token is
 * rotated to a long-lived (7 day) session token, set as an httpOnly cookie,
 * and the client is redirected into the portal. Invalid/expired tokens bounce
 * back to the login page with an error flag.
 */

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { COOKIE_NAME, COOKIE_OPTIONS } from "@/lib/portal-session";
import { portalSession } from "@/lib/schema";

// 7 days, in seconds / milliseconds.
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(
      new URL("/portal/login?error=invalid", req.url)
    );
  }

  const row = await db.query.portalSession.findFirst({
    where: and(
      eq(portalSession.token, token),
      gt(portalSession.expiresAt, new Date())
    ),
    columns: { id: true, clientId: true },
  });

  if (!row) {
    return NextResponse.redirect(
      new URL("/portal/login?error=expired", req.url)
    );
  }

  // Rotate the magic token into a long-lived session token so the original
  // link can't be replayed.
  const newToken = crypto.randomBytes(32).toString("hex");
  const newExpiry = new Date(Date.now() + SESSION_TTL_MS);

  await db
    .update(portalSession)
    .set({ token: newToken, expiresAt: newExpiry })
    .where(eq(portalSession.id, row.id));

  const jar = await cookies();
  jar.set(COOKIE_NAME, newToken, {
    ...COOKIE_OPTIONS,
    maxAge: SESSION_TTL_SECONDS,
  });

  return NextResponse.redirect(new URL("/portal", req.url));
}
