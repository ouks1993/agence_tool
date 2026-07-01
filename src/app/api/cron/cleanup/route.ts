/**
 * GET /api/cron/cleanup
 *
 * Scheduled maintenance job that prunes rows which grow unbounded and have no
 * value once expired. Runs daily (see `crons` in vercel.json). Vercel injects
 * the `Authorization: Bearer ${CRON_SECRET}` header automatically when the
 * CRON_SECRET env var is set, so we authenticate on that shared secret.
 *
 * Deletes:
 *   - booking_idempotency rows past their expiry (short-lived replay guards).
 *   - portal_session rows past their expiry (spent magic links / dead sessions).
 *   - agency_invite rows that are still "pending" AND expired (unusable invites).
 *     Accepted / revoked invites are audit history and are left untouched.
 */

import { NextResponse } from "next/server";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { agencyInvite, bookingIdempotency, portalSession } from "@/lib/schema";

// Uses the Node runtime — the Drizzle/postgres client is not edge-compatible.
export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response("Cron cleanup not configured", { status: 503 });
  }

  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();

  const deletedIdempotency = await db
    .delete(bookingIdempotency)
    .where(lt(bookingIdempotency.expiresAt, now))
    .returning({ key: bookingIdempotency.key });

  const deletedPortalSessions = await db
    .delete(portalSession)
    .where(lt(portalSession.expiresAt, now))
    .returning({ id: portalSession.id });

  const deletedInvites = await db
    .delete(agencyInvite)
    .where(
      and(eq(agencyInvite.status, "pending"), lt(agencyInvite.expiresAt, now))
    )
    .returning({ id: agencyInvite.id });

  return NextResponse.json({
    ok: true,
    deleted: {
      bookingIdempotency: deletedIdempotency.length,
      portalSessions: deletedPortalSessions.length,
      agencyInvites: deletedInvites.length,
    },
  });
}
