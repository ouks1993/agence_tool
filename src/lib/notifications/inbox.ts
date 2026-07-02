import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { booking, client, user, userNotification } from "@/lib/schema";

/**
 * In-app notification emitter (the topbar bell inbox).
 *
 * Best-effort by design: a notification is a side effect of a business action,
 * never a prerequisite. Every helper here swallows its own errors (logs + move
 * on) so a notification failure can NEVER roll back or fail the action that
 * triggered it — the same philosophy as the email adapter's "logged" fallback.
 */

/** Stable in-app notification type codes. Callers branch on these, never free-text. */
export type UserNotificationType =
  | "proposal_accepted"
  | "proposal_declined"
  | "payment_received"
  | "booking_created";

/**
 * Insert one in-app notification per recipient. Dedupes `userIds`, skips empties,
 * and never throws to the caller.
 */
export async function createUserNotifications(params: {
  agencyId: string;
  userIds: (string | null | undefined)[];
  type: UserNotificationType;
  title: string;
  body?: string | null;
  href?: string | null;
}): Promise<void> {
  try {
    // Dedupe + drop null/empty recipients.
    const recipients = [
      ...new Set(params.userIds.filter((id): id is string => Boolean(id))),
    ];
    if (recipients.length === 0) return;

    await db.insert(userNotification).values(
      recipients.map((userId) => ({
        agencyId: params.agencyId,
        userId,
        type: params.type,
        title: params.title,
        body: params.body ?? null,
        href: params.href ?? null,
      }))
    );
  } catch (err) {
    // Best-effort: log and swallow so the caller's business action is unaffected.
    console.error("[createUserNotifications]", err);
  }
}

/**
 * Ids of the agency's active admin/manager users, plus `ownerId` when provided.
 * Deduped. Best-effort — returns [] on any error so callers never break.
 */
export async function staffToNotify(
  agencyId: string,
  ownerId?: string | null
): Promise<string[]> {
  try {
    const rows = await db
      .select({ id: user.id })
      .from(user)
      .where(
        and(
          eq(user.agencyId, agencyId),
          eq(user.active, true),
          inArray(user.role, ["admin", "manager"])
        )
      );
    const ids = rows.map((r) => r.id);
    if (ownerId) ids.push(ownerId);
    return [...new Set(ids)];
  } catch (err) {
    console.error("[staffToNotify]", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Event helpers — shared by the accept/decline server actions so both the
// public-link and client-portal paths emit identical inbox notifications.
// The passed proposal shape is the minimal set both callers already have.
// ---------------------------------------------------------------------------

type ProposalForNotify = {
  id: string;
  agencyId: string;
  clientId: string | null;
  reference: string;
  title: string;
};

/** Resolves the owner of a proposal's client (for CC'ing them). Best-effort. */
async function proposalClientOwnerId(
  agencyId: string,
  clientId: string | null
): Promise<string | null> {
  if (!clientId) return null;
  try {
    const c = await db.query.client.findFirst({
      where: and(eq(client.id, clientId), eq(client.agencyId, agencyId)),
      columns: { ownerId: true },
    });
    return c?.ownerId ?? null;
  } catch (err) {
    console.error("[proposalClientOwnerId]", err);
    return null;
  }
}

/**
 * Emit inbox notifications when a proposal is accepted: one for the acceptance
 * itself, and — when the accept auto-created a booking — a second for that
 * booking. Best-effort throughout.
 */
export async function notifyProposalAccepted(
  proposal: ProposalForNotify,
  signerName: string,
  bookedId: string | null
): Promise<void> {
  const ownerId = await proposalClientOwnerId(
    proposal.agencyId,
    proposal.clientId
  );
  const recipients = await staffToNotify(proposal.agencyId, ownerId);
  if (recipients.length === 0) return;

  await createUserNotifications({
    agencyId: proposal.agencyId,
    userIds: recipients,
    type: "proposal_accepted",
    title: `Proposal accepted — ${proposal.reference || proposal.title}`,
    body: signerName ? `Signed by ${signerName}` : null,
    href: `/proposals/${proposal.id}`,
  });

  // Second notification for the auto-created booking, if one was spawned.
  if (bookedId) {
    try {
      const b = await db.query.booking.findFirst({
        where: and(
          eq(booking.id, bookedId),
          eq(booking.agencyId, proposal.agencyId)
        ),
        columns: { reference: true },
      });
      await createUserNotifications({
        agencyId: proposal.agencyId,
        userIds: recipients,
        type: "booking_created",
        title: `Booking ${b?.reference ?? ""} created — awaiting payment`.trim(),
        href: `/bookings/${bookedId}`,
      });
    } catch (err) {
      console.error("[notifyProposalAccepted] booking lookup", err);
    }
  }
}

/** Emit inbox notifications when a proposal is declined. Best-effort. */
export async function notifyProposalDeclined(
  proposal: ProposalForNotify
): Promise<void> {
  const ownerId = await proposalClientOwnerId(
    proposal.agencyId,
    proposal.clientId
  );
  const recipients = await staffToNotify(proposal.agencyId, ownerId);
  if (recipients.length === 0) return;

  await createUserNotifications({
    agencyId: proposal.agencyId,
    userIds: recipients,
    type: "proposal_declined",
    title: `Proposal declined — ${proposal.reference || proposal.title}`,
    href: `/proposals/${proposal.id}`,
  });
}

/**
 * Emit inbox notifications when an online payment for a booking completes.
 *
 * Called from the Stripe Connect webhook, which has NO staff session — the
 * agency, reference, and currency are all derived from the booking row itself.
 * Best-effort: any failure is logged and swallowed so the webhook's HTTP status
 * is never affected.
 */
export async function notifyPaymentReceived(params: {
  bookingId: string;
  amount: number | string | null | undefined;
}): Promise<void> {
  try {
    const b = await db.query.booking.findFirst({
      where: eq(booking.id, params.bookingId),
      columns: {
        agencyId: true,
        reference: true,
        currency: true,
        clientId: true,
      },
    });
    if (!b) return;

    const ownerId = await proposalClientOwnerId(b.agencyId, b.clientId);
    const recipients = await staffToNotify(b.agencyId, ownerId);
    if (recipients.length === 0) return;

    await createUserNotifications({
      agencyId: b.agencyId,
      userIds: recipients,
      type: "payment_received",
      title: `Payment received — ${b.reference}`,
      body: `${formatMoney(params.amount, b.currency)} paid online`,
      href: `/bookings/${params.bookingId}`,
    });
  } catch (err) {
    console.error("[notifyPaymentReceived]", err);
  }
}
