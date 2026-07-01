export type PaymentRowLite = {
  amount: string;
  kind: string;
  status: string;
};

/** Computes how much has been paid (refunds subtracted) and the balance due. */
export function paymentSummary(
  payments: PaymentRowLite[],
  total: number
): { paid: number; balance: number } {
  let paid = 0;
  for (const p of payments) {
    if (p.status !== "completed") continue;
    // Finite-guarded coercion (same semantics as num() in lib/analytics.ts): a
    // malformed amount must resolve to 0, not NaN, or it would poison paid /
    // balance and every booking total derived from them.
    const parsed = parseFloat(p.amount || "0");
    const amt = Number.isFinite(parsed) ? parsed : 0;
    paid += p.kind === "refund" ? -amt : amt;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return { paid: round(paid), balance: round(total - paid) };
}
