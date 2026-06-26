/**
 * Minimal, dependency-free HTML email templates. Inline styles only (email
 * clients don't support <style>/external CSS). Kept intentionally simple — a
 * richer React Email setup can replace this later without touching callers.
 */

import { APP_NAME } from "@/lib/config";

function shell(bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;overflow:hidden;">
        <tr><td style="padding:24px 32px 8px;font-size:18px;font-weight:700;color:#18181b;">${APP_NAME}</td></tr>
        <tr><td style="padding:8px 32px 32px;font-size:14px;line-height:22px;color:#3f3f46;">${bodyHtml}</td></tr>
      </table>
      <div style="max-width:480px;margin-top:16px;font-size:12px;color:#a1a1aa;">Sent by ${APP_NAME}.</div>
    </td></tr>
  </table>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:10px 20px;border-radius:8px;">${label}</a>`;
}

/**
 * A generic "click this button to do something" email (password reset, email
 * verification, etc). Returns ready-to-send HTML.
 */
export function actionEmailHtml(params: {
  heading: string;
  intro: string;
  url: string;
  cta: string;
  footnote?: string;
}): string {
  return shell(
    `<p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#18181b;">${params.heading}</p>
     <p style="margin:0 0 24px;">${params.intro}</p>
     <p style="margin:0 0 24px;">${button(params.url, params.cta)}</p>
     ${params.footnote ? `<p style="margin:0;font-size:12px;color:#a1a1aa;">${params.footnote}</p>` : ""}`
  );
}

/**
 * Magic-link login email for the client-facing Traveler Portal. Returns both a
 * ready-to-send subject and HTML body (and a plain-text fallback) so the caller
 * can pass them straight to `sendEmail`.
 */
export function portalMagicLinkEmail(params: {
  clientName: string;
  agencyName: string;
  magicLinkUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `Your login link for ${params.agencyName}`;
  const html = shell(
    `<p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#18181b;">Hello, ${params.clientName}</p>
     <p style="margin:0 0 24px;">Click the button below to access your travel portal for <strong>${params.agencyName}</strong>. This link expires in 15 minutes.</p>
     <p style="margin:0 0 24px;">${button(params.magicLinkUrl, "Access my trips")}</p>
     <p style="margin:0;font-size:12px;color:#a1a1aa;">If you didn't request this link, you can safely ignore this email.</p>`
  );
  const text = `Hello, ${params.clientName}\n\nAccess your travel portal for ${params.agencyName} using the link below. It expires in 15 minutes.\n\n${params.magicLinkUrl}\n\nIf you didn't request this link, you can safely ignore this email.`;
  return { subject, html, text };
}

/** Invitation to join an agency workspace. */
export function inviteEmailHtml(params: {
  agencyName: string;
  roleLabel: string;
  url: string;
}): string {
  return shell(
    `<p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#18181b;">You've been invited to ${params.agencyName}</p>
     <p style="margin:0 0 24px;">You've been invited to join <strong>${params.agencyName}</strong> on ${APP_NAME} as <strong>${params.roleLabel}</strong>. Accept the invite to create your account.</p>
     <p style="margin:0 0 24px;">${button(params.url, "Accept invite")}</p>
     <p style="margin:0;font-size:12px;color:#a1a1aa;">This invite expires in 7 days. If you weren't expecting it, you can ignore this email.</p>`
  );
}
