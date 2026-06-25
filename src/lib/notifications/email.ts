/**
 * Email adapter.
 *
 * Sends via the Resend API when RESEND_API_KEY and EMAIL_FROM are set.
 * Otherwise it logs the email to the server console and reports "logged" so the
 * workflow (and the communications log) still works in development.
 */

import { Resend } from "resend";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export type EmailResult = {
  status: "sent" | "logged" | "failed";
  error?: string;
};

export async function sendEmail(params: {
  to: string;
  subject: string;
  /** Plain-text body. At least one of `text` / `html` should be provided. */
  text: string;
  /** Optional HTML body for branded mail (Resend sends both when present). */
  html?: string;
}): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    // eslint-disable-next-line no-console
    console.log(
      `\n${"=".repeat(60)}\nEMAIL (not sent — RESEND_API_KEY not set)\nTo: ${params.to}\nSubject: ${params.subject}\n\n${params.text}\n${"=".repeat(60)}\n`
    );
    return { status: "logged" };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM as string,
      to: params.to,
      subject: params.subject,
      text: params.text,
      ...(params.html ? { html: params.html } : {}),
    });
    if (error) {
      return { status: "failed", error: `Resend: ${error.message}` };
    }
    return { status: "sent" };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : "Email error" };
  }
}
