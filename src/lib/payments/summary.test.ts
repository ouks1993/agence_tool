import { describe, it, expect } from "vitest";
import { paymentSummary, type PaymentRowLite } from "@/lib/payments/summary";

const p = (
  amount: string,
  kind: string,
  status: string
): PaymentRowLite => ({ amount, kind, status });

describe("paymentSummary", () => {
  it("counts only completed payments toward paid", () => {
    const rows = [
      p("100", "payment", "completed"),
      p("50", "payment", "pending"),
      p("30", "payment", "failed"),
    ];
    expect(paymentSummary(rows, 200)).toEqual({ paid: 100, balance: 100 });
  });

  it("subtracts completed refunds from paid", () => {
    const rows = [
      p("100", "payment", "completed"),
      p("40", "refund", "completed"),
    ];
    expect(paymentSummary(rows, 200)).toEqual({ paid: 60, balance: 140 });
  });

  it("ignores a pending refund", () => {
    const rows = [
      p("100", "payment", "completed"),
      p("40", "refund", "pending"),
    ];
    expect(paymentSummary(rows, 200)).toEqual({ paid: 100, balance: 100 });
  });

  it("coerces a malformed amount to 0 (NaN guard)", () => {
    const rows = [
      p("not-a-number", "payment", "completed"),
      p("", "payment", "completed"),
      p("75", "payment", "completed"),
    ];
    expect(paymentSummary(rows, 100)).toEqual({ paid: 75, balance: 25 });
  });

  it("rounds paid and balance to 2dp", () => {
    const rows = [
      p("10.005", "payment", "completed"),
      p("0.005", "payment", "completed"),
    ];
    const out = paymentSummary(rows, 20);
    expect(out.paid).toBe(10.01);
    expect(out.balance).toBe(9.99);
  });

  it("allows a negative balance (overpayment)", () => {
    const rows = [p("250", "payment", "completed")];
    expect(paymentSummary(rows, 200)).toEqual({ paid: 250, balance: -50 });
  });

  it("returns zero paid and full balance for no payments", () => {
    expect(paymentSummary([], 300)).toEqual({ paid: 0, balance: 300 });
  });
});
