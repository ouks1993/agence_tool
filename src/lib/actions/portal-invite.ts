"use server";

import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import type { ActionResult } from "@/lib/actions/types";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { requireAgencyUser } from "@/lib/permissions";
import { client, notification, portalSession } from "@/lib/schema";

// Magic-link token lifetime for an agent-triggered invite. Longer than the
// self-service 15-minute flow because the agent sends this ahead of time and
// the client may not open it immediately.
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Sends (or re-sends) a Traveler Portal magic-link invite to a client on behalf
 * of an agent. Mirrors the token logic in `/api/portal/auth/request`: a random
 * token is stored in `portal_session` and the verify endpoint rotates it into a
 * long-lived session when the client clicks through.
 *
 * Returns the portal URL on success so the agent can copy it manually when email
 * delivery isn't configured.
 */
export async function sendPortalInvite(
  clientId: string
): Promise<ActionResult<{ portalUrl: string }>> {
  const user = await requireAgencyUser();

  // Scope to the agent's agency so one tenant can never invite another's client.
  const c = await db.query.client.findFirst({
    where: and(eq(client.id, clientId), eq(client.agencyId, user.agencyId)),
    columns: { id: true, name: true, email: true },
  });
  if (!c) return { ok: false, error: "Client not found" };

  if (!c.email) {
    return { ok: false, error: "Client has no email address." };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  try {
    await db.insert(portalSession).values({
      clientId: c.id,
      token,
      expiresAt,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    // The verify endpoint consumes the magic token and establishes the session.
    const portalUrl = `${appUrl}/api/portal/auth/verify?token=${token}`;

    const subject = "Your trip portal access";
    const text =
      `Hi ${c.name},\n\n` +
      `You can now access your trip portal to view your bookings and documents.\n\n` +
      `Open your portal: ${portalUrl}\n\n` +
      `This link is personal to you — please don't share it.`;

    const result = await sendEmail({ to: c.email, subject, text });

    // Record the invite in the communications log. `bookingId` is null because an
    // invite is scoped to the client, not a single booking.
    await db.insert(notification).values({
      agencyId: user.agencyId,
      bookingId: null,
      channel: "email",
      recipient: c.email,
      subject,
      body: text,
      kind: "portal_invite",
      status: result.status,
      error: result.error ?? null,
      createdById: user.id,
    });

    return { ok: true, data: { portalUrl } };
  } catch (err) {
    console.error("[sendPortalInvite]", err);
    return { ok: false, error: "Could not send the portal invite. Please try again." };
  }
}
