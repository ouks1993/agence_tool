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
    const amt = parseFloat(p.amount || "0");
    paid += p.kind === "refund" ? -amt : amt;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return { paid: round(paid), balance: round(total - paid) };
}
