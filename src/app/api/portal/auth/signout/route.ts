/**
 * POST /api/portal/auth/signout
 *
 * Ends the Traveler Portal session: deletes the session row (so the token is
 * invalidated server-side) and clears the cookie, then redirects to login.
 *
 * Must be POST (not GET): a state-changing GET is exploitable via CSRF — e.g.
 * `<img src=".../signout">` would force-log-out the client (CWE-352).
 */

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/portal-session";
import { portalSession } from "@/lib/schema";

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await db.delete(portalSession).where(eq(portalSession.token, token));
    jar.delete(COOKIE_NAME);
  }
  // 303 See Other: after the state-changing POST, the browser follows up with
  // a GET to the login page (rather than re-POSTing, as a default 307 would).
  return NextResponse.redirect(new URL("/portal/login", req.url), { status: 303 });
}
