/**
 * Deposit-threshold helpers for the booking lifecycle.
 *
 * A booking reaches `confirmed` once the client has paid at least the agency's
 * configured deposit (a % of the booking total) — the same deposit the public
 * proposal promises "secures your dates". These are pure functions with no I/O
 * so both the server-side lifecycle guards and the client-facing proposal copy
 * derive the figure identically.
 */

/** Round to 2 decimal places (cents). Mirrors `round2` used across the actions. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Finite-guarded coercion: a non-finite value resolves to `fallback`. */
function finite(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

/** Clamp a percent into the valid [0, 100] range. */
function clampPercent(percent: number): number {
  const p = finite(percent, 0);
  if (p < 0) return 0;
  if (p > 100) return 100;
  return p;
}

/**
 * The deposit amount required for a booking of `total` at `depositPercent`.
 *
 * - `depositPercent` is clamped to [0, 100] (a stored/typed value out of range
 *   can never demand more than the full total or a negative deposit).
 * - Non-finite `total` is treated as 0; non-finite `depositPercent` as 0 (no
 *   deposit) so bad data can never fabricate a payment gate.
 * - The result is rounded to 2dp so it matches the cent-precision of stored
 *   money and the figure shown to the client.
 */
export function depositAmount(total: number, depositPercent: number): number {
  const safeTotal = Math.max(0, finite(total, 0));
  const pct = clampPercent(depositPercent);
  return round2((safeTotal * pct) / 100);
}

/**
 * True when `paid` covers the required deposit for `total` at `depositPercent`.
 *
 * Both sides are rounded to cents before comparison so float noise (e.g.
 * 623025.00 vs 623025.004) can never keep a fully-deposited booking from
 * confirming. `depositPercent` 0 is always satisfied (no deposit required);
 * `depositPercent` 100 collapses to the zero-outstanding-balance rule.
 */
export function meetsDepositThreshold(
  total: number,
  paid: number,
  depositPercent: number
): boolean {
  const required = depositAmount(total, depositPercent);
  const paidCents = Math.round(Math.max(0, finite(paid, 0)) * 100);
  const requiredCents = Math.round(required * 100);
  return paidCents >= requiredCents;
}
