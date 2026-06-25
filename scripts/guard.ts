/**
 * Safety guard for destructive scripts (seeding, isolation tests, resets).
 *
 * Prod and dev historically shared one Neon database, so a stray local run of a
 * seed/reset could wipe production. This refuses to run against a protected
 * target unless explicitly overridden.
 *
 * A target is "protected" when:
 *   - NODE_ENV === "production", OR
 *   - the POSTGRES_URL host matches an entry in PROTECTED_DB_HOSTS
 *     (comma-separated substrings — set this in your prod/Vercel env, never in
 *     local .env, e.g. PROTECTED_DB_HOSTS=ep-prod-xxxx.neon.tech)
 *
 * Override for an intentional run with ALLOW_PROD=1.
 */
export function assertSafeDestructiveTarget(label = "this destructive script"): void {
  if (process.env.ALLOW_PROD === "1") return;

  const url = process.env.POSTGRES_URL ?? "";
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    host = "";
  }

  const protectedHosts = (process.env.PROTECTED_DB_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  const matchedHost =
    host && protectedHosts.find((h) => host.includes(h));

  if (process.env.NODE_ENV === "production" || matchedHost) {
    const reason =
      process.env.NODE_ENV === "production"
        ? "NODE_ENV is production"
        : `target host "${host}" matches PROTECTED_DB_HOSTS ("${matchedHost}")`;
    throw new Error(
      `Refusing to run ${label}: ${reason}. ` +
        `If you really mean to, re-run with ALLOW_PROD=1.`
    );
  }
}
