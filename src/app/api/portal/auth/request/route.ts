/**
 * POST /api/portal/auth/request
 *
 * Starts the Traveler Portal magic-link flow. Looks up a client by email and,
 * if found, creates a short-lived (15 min) magic token and emails the link.
 * Always responds `{ ok: true }` regardless of whether the email matched, so
 * the endpoint never reveals which addresses have an account.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { portalMagicLinkEmail } from "@/lib/notifications/templates";
import { client, portalSession } from "@/lib/schema";

// 15 minutes, in milliseconds.
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: unknown };
    const email = body.email;
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { ok: false, error: "Email required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // `client.email` is nullable and not unique; matching on a normalized value
    // is best-effort. We never reveal whether a match was found.
    const found = await db.query.client.findFirst({
      where: eq(client.email, normalizedEmail),
      columns: { id: true, name: true, email: true },
      with: { agency: { columns: { name: true } } },
    });

    if (found?.email) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);

      // Invalidate any prior pending magic links for this client so only the
      // newest link is usable (requesting a fresh link retires the old one).
      // Never touch "session" rows — those are the client's live logins.
      await db
        .delete(portalSession)
        .where(
          and(
            eq(portalSession.clientId, found.id),
            eq(portalSession.purpose, "magic")
          )
        );

      await db.insert(portalSession).values({
        clientId: found.id,
        token,
        purpose: "magic",
        expiresAt,
      });

      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const magicLinkUrl = `${appUrl}/api/portal/auth/verify?token=${token}`;

      try {
        const { subject, html, text } = portalMagicLinkEmail({
          clientName: found.name,
          agencyName: found.agency?.name ?? "your agency",
          magicLinkUrl,
        });
        await sendEmail({ to: found.email, subject, html, text });
      } catch (err) {
        // If the email transport throws, surface the link to the server log so
        // the flow remains usable while email is unconfigured.
        // eslint-disable-next-line no-console
        console.log("[portal] magic link (email failed):", magicLinkUrl);
        console.error("[portal] email error:", err);
      }
    }

    // Always succeed — do not leak whether the email exists.
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[portal/auth/request]", err);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
