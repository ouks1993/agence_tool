"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createBookingFromAcceptedProposal } from "@/lib/actions/bookings";
import type { ActionResult } from "@/lib/actions/types";
import { logActivity } from "@/lib/activity";
import { APP_NAME } from "@/lib/config";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { notification, opportunity, product } from "@/lib/schema";

/**
 * Public, TOKEN-authenticated proposal actions.
 *
 * Unlike every other product action these do NOT call requireAgencyUser — the
 * unguessable share token IS the authorization. The client opening /p/[token]
 * can accept (and e-sign) or decline the proposal without an account.
 */

const acceptInput = z.object({
  token: z.string().min(1),
  signerName: z.string().trim().min(2, "Please enter your full name.").max(120),
  signerEmail: z.string().trim().email("Enter a valid email.").max(200),
  // Typed full name acts as the signature; required so acceptance is deliberate.
  signature: z.string().trim().min(2, "Type your name to sign.").max(120),
});

export type AcceptProposalInput = z.input<typeof acceptInput>;

/** Reads the client IP + user agent from request headers for the audit trail. */
async function signerMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent") };
}

/** Accepts and e-signs a proposal via its public share token. */
export async function acceptProposalByToken(
  raw: AcceptProposalInput
): Promise<ActionResult> {
  const parsed = acceptInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const p = await db.query.product.findFirst({
    where: eq(product.shareToken, d.token),
  });
  if (!p) return { ok: false, error: "This proposal link is no longer valid." };
  if (p.acceptedAt) return { ok: false, error: "This proposal has already been accepted." };
  if (p.declinedAt) return { ok: false, error: "This proposal was declined." };
  if (p.validUntil && p.validUntil.getTime() < Date.now()) {
    return { ok: false, error: "This proposal has expired. Please ask for an updated one." };
  }

  const { ip, userAgent } = await signerMeta();
  const now = new Date();

  try {
    await db
      .update(product)
      .set({
        status: "accepted",
        acceptedAt: now,
        signerName: d.signerName,
        signerEmail: d.signerEmail,
        signatureData: d.signature,
        signerIp: ip,
        signerUserAgent: userAgent,
      })
      .where(eq(product.id, p.id));

    // Acceptance closes the linked opportunity as won.
    if (p.opportunityId) {
      await db
        .update(opportunity)
        .set({ stage: "won" })
        .where(eq(opportunity.id, p.opportunityId));
    }

    // Confirmation email to the signer (best-effort) + agency audit row.
    const subject = `Proposal ${p.reference} accepted`;
    const text = `Hi ${d.signerName},\n\nThank you — we've recorded your acceptance of proposal ${p.reference} ("${p.title}").\n\nOur team will be in touch with the next steps.\n\nKind regards,\n${APP_NAME}`;
    const result = await sendEmail({ to: d.signerEmail, subject, text });

    await db.insert(notification).values({
      agencyId: p.agencyId,
      channel: "email",
      recipient: d.signerEmail,
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
      metadata: { acceptedBy: d.signerName, via: "public_link" },
    });

    // Best-effort auto-booking: the client has committed by signing, so spawn
    // the booking. This must NEVER fail the client's acceptance — on any error
    // we log and still return success (the agent can convert manually later).
    // The helper is idempotent and derives the tenant from the proposal's own
    // agencyId.
    try {
      const booked = await createBookingFromAcceptedProposal(p.id, {
        actorUserId: p.createdById ?? null,
      });
      if (!booked.ok) {
        console.error("[acceptProposalByToken] auto-booking:", booked.error);
      } else {
        revalidatePath("/bookings");
      }
    } catch (bookErr) {
      console.error("[acceptProposalByToken] auto-booking threw:", bookErr);
    }

    revalidatePath(`/p/${d.token}`);
    return { ok: true };
  } catch (err) {
    console.error("[acceptProposalByToken]", err);
    return { ok: false, error: "Could not accept the proposal. Please try again." };
  }
}

/** Declines a proposal via its public share token. */
export async function declineProposalByToken(token: string): Promise<ActionResult> {
  if (!token) return { ok: false, error: "Invalid link." };

  const p = await db.query.product.findFirst({
    where: eq(product.shareToken, token),
  });
  if (!p) return { ok: false, error: "This proposal link is no longer valid." };
  if (p.acceptedAt) return { ok: false, error: "This proposal has already been accepted." };
  if (p.declinedAt) return { ok: false, error: "This proposal was already declined." };

  const { ip, userAgent } = await signerMeta();

  try {
    await db
      .update(product)
      .set({
        status: "rejected",
        declinedAt: new Date(),
        signerIp: ip,
        signerUserAgent: userAgent,
      })
      .where(eq(product.id, p.id));

    await logActivity({
      agencyId: p.agencyId,
      userId: null,
      action: "status_changed",
      entityType: "product",
      entityId: p.id,
      entityLabel: `${p.reference} · ${p.title}`,
      metadata: { declined: true, via: "public_link" },
    });

    revalidatePath(`/p/${token}`);
    return { ok: true };
  } catch (err) {
    console.error("[declineProposalByToken]", err);
    return { ok: false, error: "Could not decline the proposal. Please try again." };
  }
}
