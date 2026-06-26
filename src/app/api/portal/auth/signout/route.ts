/**
 * GET /api/portal/auth/signout
 *
 * Ends the Traveler Portal session: deletes the session row (so the token is
 * invalidated server-side) and clears the cookie, then redirects to login.
 */

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/portal-session";
import { portalSession } from "@/lib/schema";

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await db.delete(portalSession).where(eq(portalSession.token, token));
    jar.delete(COOKIE_NAME);
  }
  return NextResponse.redirect(new URL("/portal/login", req.url));
}
