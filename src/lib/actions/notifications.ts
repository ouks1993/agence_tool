"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import { logActivity } from "@/lib/activity";
import { APP_NAME } from "@/lib/config";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { sendEmail } from "@/lib/notifications/email";
import { paymentSummary } from "@/lib/payments/summary";
import { requireAgencyUser } from "@/lib/permissions";
import { booking, notification } from "@/lib/schema";

type BookingWithRelations = {
  reference: string;
  destination: string | null;
  departDate: Date | null;
  returnDate: Date | null;
  currency: string;
  totalAmount: string;
  client: { name: string; email: string | null } | null;
  items: { title: string; supplier: string | null; confirmationNumber: string | null }[];
  payments: { amount: string; kind: string; status: string }[];
};

function buildEmail(
  b: BookingWithRelations,
  kind: "confirmation" | "voucher" | "receipt"
): { subject: string; text: string } {
  const hello = `Dear ${b.client?.name ?? "traveller"},`;
  const trip = b.destination ? ` to ${b.destination}` : "";
  const dates =
    b.departDate || b.returnDate
      ? ` (${formatDate(b.departDate)} → ${formatDate(b.returnDate)})`
      : "";
  const sign = `\n\nKind regards,\n${APP_NAME}`;

  if (kind === "confirmation") {
    const lines = b.items.map((i) => `• ${i.title}${i.supplier ? ` — ${i.supplier}` : ""}`).join("\n");
    return {
      subject: `Booking ${b.reference} confirmed`,
      text: `${hello}\n\nYour trip${trip}${dates} is confirmed. Reference ${b.reference}.\n\nIncluded:\n${lines || "—"}\n\nTotal: ${formatMoney(b.totalAmount, b.currency)}.${sign}`,
    };
  }
  if (kind === "voucher") {
    const lines = b.items
      .map(
        (i) =>
          `• ${i.title}${i.supplier ? ` — ${i.supplier}` : ""}${
            i.confirmationNumber ? ` (Ref: ${i.confirmationNumber})` : ""
          }`
      )
      .join("\n");
    return {
      subject: `Your travel voucher — ${b.reference}`,
      text: `${hello}\n\nPlease find your travel voucher for trip${trip}${dates}.\n\nConfirmed services:\n${lines || "—"}\n\nPlease present this voucher at check-in.${sign}`,
    };
  }
  // receipt
  const total = parseFloat(b.totalAmount || "0");
  const { paid, balance } = paymentSummary(b.payments, total);
  return {
    subject: `Payment receipt — ${b.reference}`,
    text: `${hello}\n\nThank you for your payment toward booking ${b.reference}.\n\nTotal: ${formatMoney(total, b.currency)}\nPaid: ${formatMoney(paid, b.currency)}\nBalance due: ${formatMoney(balance, b.currency)}${sign}`,
  };
}

const input = z.object({
  bookingId: z.string().min(1),
  kind: z.enum(["confirmation", "voucher", "receipt", "custom"]),
  toOverride: z.string().trim().email().optional().or(z.literal("")),
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().max(10000).optional(),
});

export type SendEmailInput = z.input<typeof input>;

export async function sendBookingEmail(
  raw: SendEmailInput
): Promise<ActionResult<{ status: string }>> {
  const user = await requireAgencyUser();
  const parsed = input.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  const b = await db.query.booking.findFirst({
    where: and(eq(booking.id, d.bookingId), eq(booking.agencyId, user.agencyId)),
    with: {
      client: { columns: { name: true, email: true } },
      items: { columns: { title: true, supplier: true, confirmationNumber: true } },
      payments: { columns: { amount: true, kind: true, status: true } },
    },
  });
  if (!b) return { ok: false, error: "Booking not found" };

  const recipient = d.toOverride || b.client?.email;
  if (!recipient) {
    return { ok: false, error: "No recipient email. Add an email to the client or enter one." };
  }

  let subject: string;
  let text: string;
  if (d.kind === "custom") {
    if (!d.subject || !d.body) {
      return { ok: false, error: "Subject and message are required" };
    }
    subject = d.subject;
    text = d.body;
  } else {
    ({ subject, text } = buildEmail(b as BookingWithRelations, d.kind));
  }

  try {
    const result = await sendEmail({ to: recipient, subject, text });

    await db.insert(notification).values({
      agencyId: user.agencyId,
      bookingId: d.bookingId,
      channel: "email",
      recipient,
      subject,
      body: text,
      kind: d.kind,
      status: result.status,
      error: result.error ?? null,
      createdById: user.id,
    });

    await logActivity({
      agencyId: user.agencyId,
      userId: user.id,
      action: "sent",
      entityType: "booking",
      entityId: d.bookingId,
      entityLabel: b.reference,
      metadata: { email: d.kind, to: recipient, status: result.status },
    });

    revalidatePath(`/bookings/${d.bookingId}`);

    if (result.status === "failed") {
      return { ok: false, error: result.error ?? "Email failed to send" };
    }
    return { ok: true, data: { status: result.status } };
  } catch (err) {
    console.error("[sendBookingEmail]", err);
    return { ok: false, error: "Could not send the email. Please try again." };
  }
}
