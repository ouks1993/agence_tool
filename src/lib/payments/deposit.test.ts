import { describe, it, expect } from "vitest";
import { depositAmount, meetsDepositThreshold } from "@/lib/payments/deposit";

describe("depositAmount", () => {
  it("computes the percent of the total (2dp)", () => {
    expect(depositAmount(1000, 50)).toBe(500);
    expect(depositAmount(1246050, 50)).toBe(623025);
  });

  it("percent 0 requires no deposit", () => {
    expect(depositAmount(1000, 0)).toBe(0);
  });

  it("percent 100 equals the full total", () => {
    expect(depositAmount(1000, 100)).toBe(1000);
  });

  it("clamps a percent above 100 to 100 (full total)", () => {
    expect(depositAmount(1000, 150)).toBe(1000);
  });

  it("clamps a negative percent to 0 (no deposit)", () => {
    expect(depositAmount(1000, -20)).toBe(0);
  });

  it("treats a non-finite total as 0", () => {
    expect(depositAmount(Number.NaN, 50)).toBe(0);
    expect(depositAmount(Number.POSITIVE_INFINITY, 50)).toBe(0);
  });

  it("treats a non-finite percent as 0 (no deposit)", () => {
    expect(depositAmount(1000, Number.NaN)).toBe(0);
  });

  it("treats a negative total as 0", () => {
    expect(depositAmount(-1000, 50)).toBe(0);
  });

  it("rounds to 2dp at the .005 boundary", () => {
    // 33.333% of 100.03 = 33.339999 -> 33.34 after 2dp rounding.
    expect(depositAmount(100.03, 33.333)).toBe(33.34);
    // 10% of 0.05 = 0.005 -> 0.01 (round half up).
    expect(depositAmount(0.05, 10)).toBe(0.01);
  });
});

describe("meetsDepositThreshold", () => {
  it("is true when paid exactly equals the deposit", () => {
    expect(meetsDepositThreshold(1000, 500, 50)).toBe(true);
  });

  it("is false one cent under the deposit", () => {
    expect(meetsDepositThreshold(1000, 499.99, 50)).toBe(false);
  });

  it("is true when overpaid past the deposit", () => {
    expect(meetsDepositThreshold(1000, 750, 50)).toBe(true);
    expect(meetsDepositThreshold(1000, 1000, 50)).toBe(true);
  });

  it("percent 0 is always satisfied, even with nothing paid", () => {
    expect(meetsDepositThreshold(1000, 0, 0)).toBe(true);
  });

  it("percent 100 equals the zero-balance rule", () => {
    expect(meetsDepositThreshold(1000, 1000, 100)).toBe(true);
    expect(meetsDepositThreshold(1000, 999.99, 100)).toBe(false);
  });

  it("clamps percent >100 to full total", () => {
    expect(meetsDepositThreshold(1000, 1000, 150)).toBe(true);
    expect(meetsDepositThreshold(1000, 999, 150)).toBe(false);
  });

  it("clamps percent <0 to no deposit (always satisfied)", () => {
    expect(meetsDepositThreshold(1000, 0, -10)).toBe(true);
  });

  it("treats non-finite paid as 0", () => {
    expect(meetsDepositThreshold(1000, Number.NaN, 50)).toBe(false);
    expect(meetsDepositThreshold(1000, Number.NaN, 0)).toBe(true);
  });

  it("cent-rounds so float noise cannot block confirmation", () => {
    // 50% of 1_246_050 = 623_025; a paid figure carrying sub-cent float noise
    // just under the exact deposit must still satisfy the threshold.
    expect(meetsDepositThreshold(1246050, 623025.004, 50)).toBe(true);
    expect(meetsDepositThreshold(1246050, 623024.996, 50)).toBe(true);
  });
});
