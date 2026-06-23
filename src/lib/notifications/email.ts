/**
 * Email adapter.
 *
 * Sends via the SendGrid REST API when SENDGRID_API_KEY and EMAIL_FROM are set.
 * Otherwise it logs the email to the server console and reports "logged" so the
 * workflow (and the communications log) still works in development.
 */

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM);
}

export type EmailResult = {
  status: "sent" | "logged" | "failed";
  error?: string;
};

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    // eslint-disable-next-line no-console
    console.log(
      `\n${"=".repeat(60)}\nEMAIL (not sent — SENDGRID_API_KEY not set)\nTo: ${params.to}\nSubject: ${params.subject}\n\n${params.text}\n${"=".repeat(60)}\n`
    );
    return { status: "logged" };
  }

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: params.to }] }],
        from: { email: process.env.EMAIL_FROM },
        subject: params.subject,
        content: [{ type: "text/plain", value: params.text }],
      }),
    });
    if (!res.ok && res.status !== 202) {
      const body = await res.text().catch(() => "");
      return { status: "failed", error: `SendGrid ${res.status}: ${body.slice(0, 200)}` };
    }
    return { status: "sent" };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : "Email error" };
  }
}
