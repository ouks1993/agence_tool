"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { createBookingFromAcceptedProposal } from "@/lib/actions/bookings";
import type { ActionResult } from "@/lib/actions/types";
import { logActivity } from "@/lib/activity";
import { APP_NAME } from "@/lib/config";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { requirePortalSession } from "@/lib/portal-session";
import { notification, opportunity, product } from "@/lib/schema";

/** Reads client IP + user agent for the e-signature audit trail. */
async function signerMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent") };
}

/**
 * Accept (e-sign) a proposal from within the authenticated client portal.
 *
 * Authorization: portal session — the product's clientId must match
 * session.client.id and agencyId must match session.client.agencyId.
 */
export async function acceptProposalFromPortal(
  productId: string,
  signature: string
): Promise<ActionResult> {
  const session = await requirePortalSession();

  if (!signature.trim() || signature.trim().length < 2) {
    return { ok: false, error: "Please type your full name to sign." };
  }

  // Ownership: product must belong to this client and agency.
  const p = await db.query.product.findFirst({
    where: and(
      eq(product.id, productId),
      eq(product.clientId, session.client.id),
      eq(product.agencyId, session.client.agencyId)
    ),
  });
  if (!p) return { ok: false, error: "Proposal not found." };
  if (p.acceptedAt) return { ok: false, error: "This proposal has already been accepted." };
  if (p.declinedAt) return { ok: false, error: "This proposal was declined." };
  if (p.validUntil && p.validUntil.getTime() < Date.now()) {
    return { ok: false, error: "This proposal has expired. Please contact your agent." };
  }

  const { ip, userAgent } = await signerMeta();
  const now = new Date();

  try {
    // First-writer-wins: the WHERE re-asserts the not-yet-accepted / not-declined
    // guard atomically with the write, so two near-simultaneous accepts can't both
    // pass the pre-read above and clobber each other's signer identity. Only the
    // first UPDATE matches these predicates; `.returning()` gives the winner a row
    // and the loser an empty array.
    const [claimed] = await db
      .update(product)
      .set({
        status: "accepted",
        acceptedAt: now,
        signerName: session.client.name,
        signerEmail: session.client.email,
        signatureData: signature.trim(),
        signerIp: ip,
        signerUserAgent: userAgent,
      })
      .where(
        and(
          eq(product.id, p.id),
          isNull(product.acceptedAt),
          isNull(product.declinedAt)
        )
      )
      .returning({ id: product.id });

    // Lost the race: take the same path as the "already accepted" early-return —
    // do NOT run the side effects.
    if (!claimed) {
      return { ok: false, error: "This proposal has already been accepted." };
    }

    // Close the linked opportunity as won.
    if (p.opportunityId) {
      await db
        .update(opportunity)
        .set({ stage: "won" })
        .where(eq(opportunity.id, p.opportunityId));
    }

    // Confirmation email (best-effort) + audit log. The client `email` column is
    // NOT NULL in the schema, so fall back to an empty string only to satisfy the
    // (over-wide) nullable session type.
    const recipientEmail = session.client.email ?? "";
    const subject = `Proposal ${p.reference} accepted`;
    const text = `Hi ${session.client.name},\n\nThank you — we've recorded your acceptance of proposal ${p.reference} ("${p.title}").\n\nOur team will be in touch with the next steps.\n\nKind regards,\n${APP_NAME}`;
    const result = await sendEmail({ to: recipientEmail, subject, text });

    await db.insert(notification).values({
      agencyId: p.agencyId,
      channel: "email",
      recipient: recipientEmail,
      subject,
      body: text,
      kind: "proposal",
      status: result.status,
      error: result.error ?? null,
    });

    await logActivity({
      agencyId: p.agencyId,
      userId: null,
      action: "status_changed",
      entityType: "product",
      entityId: p.id,
      entityLabel: `${p.reference} · ${p.title}`,
      metadata: { acceptedBy: session.client.name, via: "client_portal" },
    });

    // Best-effort auto-booking: the client has committed, so spawn the booking.
    // This must NEVER fail the client's acceptance — on any error we log and
    // still return success (the agent can convert manually later). The helper is
    // idempotent and derives the tenant from the proposal's own agencyId.
    try {
      const booked = await createBookingFromAcceptedProposal(p.id, {
        actorUserId: p.createdById ?? null,
      });
      if (!booked.ok) {
        console.error("[acceptProposalFromPortal] auto-booking:", booked.error);
      } else {
        revalidatePath("/bookings");
      }
    } catch (bookErr) {
      console.error("[acceptProposalFromPortal] auto-booking threw:", bookErr);
    }

    revalidatePath(`/portal/proposals/${productId}`);
    revalidatePath("/portal/proposals");
    return { ok: true };
  } catch (err) {
    console.error("[acceptProposalFromPortal]", err);
    return { ok: false, error: "Could not accept the proposal. Please try again." };
  }
}

/**
 * Decline a proposal from within the authenticated client portal.
 */
export async function declineProposalFromPortal(productId: string): Promise<ActionResult> {
  const session = await requirePortalSession();

  const p = await db.query.product.findFirst({
    where: and(
      eq(product.id, productId),
      eq(product.clientId, session.client.id),
      eq(product.agencyId, session.client.agencyId)
    ),
  });
  if (!p) return { ok: false, error: "Proposal not found." };
  if (p.acceptedAt) return { ok: false, error: "This proposal has already been accepted." };
  if (p.declinedAt) return { ok: false, error: "This proposal was already declined." };

  const { ip, userAgent } = await signerMeta();

  try {
    // First-writer-wins: same conditional-write pattern as acceptance. A decline
    // that races an accept (or another decline) only commits when the proposal is
    // still un-actioned; the loser falls through to the "already accepted" shape.
    const [claimed] = await db
      .update(product)
      .set({
        status: "rejected",
        declinedAt: new Date(),
        signerIp: ip,
        signerUserAgent: userAgent,
      })
      .where(
        and(
          eq(product.id, p.id),
          isNull(product.acceptedAt),
          isNull(product.declinedAt)
        )
      )
      .returning({ id: product.id });

    if (!claimed) {
      return { ok: false, error: "This proposal has already been accepted." };
    }

    await logActivity({
      agencyId: p.agencyId,
      userId: null,
      action: "status_changed",
      entityType: "product",
      entityId: p.id,
      entityLabel: `${p.reference} · ${p.title}`,
      metadata: { declined: true, via: "client_portal" },
    });

    revalidatePath(`/portal/proposals/${productId}`);
    revalidatePath("/portal/proposals");
    return { ok: true };
  } catch (err) {
    console.error("[declineProposalFromPortal]", err);
    return { ok: false, error: "Could not decline the proposal. Please try again." };
  }
}
