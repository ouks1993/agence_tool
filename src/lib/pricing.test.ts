import { describe, expect, it } from "vitest";
import {
  lineTotal,
  marginFromCostPrice,
  priceFromMargin,
  round2,
  toNumber,
} from "@/lib/pricing";

describe("round2", () => {
  it("rounds to two decimals", () => {
    expect(round2(1.005)).toBe(1); // JS float: 1.005 → 1.00499… rounds down
    expect(round2(100.126)).toBe(100.13);
    expect(round2(114.9885)).toBe(114.99);
    expect(round2(0)).toBe(0);
  });
});

describe("toNumber", () => {
  it("parses numeric strings", () => {
    expect(toNumber("120.50")).toBe(120.5);
    expect(toNumber("0")).toBe(0);
  });
  it("passes finite numbers through", () => {
    expect(toNumber(42)).toBe(42);
  });
  it("falls back to 0 for null/undefined/garbage", () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber("")).toBe(0);
    expect(toNumber("abc")).toBe(0);
    expect(toNumber(Number.NaN)).toBe(0);
    expect(toNumber(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("priceFromMargin", () => {
  it("adds the margin on top of net cost", () => {
    expect(priceFromMargin(100, 15)).toBe(115);
    expect(priceFromMargin(200, 0)).toBe(200);
    expect(priceFromMargin(100, 12.5)).toBe(112.5);
  });
  it("rounds the result to two decimals", () => {
    expect(priceFromMargin(99.99, 15)).toBe(114.99); // 114.9885 → 114.99
  });
  it("leaves a zero cost at zero regardless of margin", () => {
    expect(priceFromMargin(0, 30)).toBe(0);
  });
});

describe("marginFromCostPrice", () => {
  it("derives the margin percentage from a cost/price pair", () => {
    expect(marginFromCostPrice(100, 115)).toBeCloseTo(15, 10);
    expect(marginFromCostPrice(200, 200)).toBe(0);
    expect(marginFromCostPrice(100, 90)).toBeCloseTo(-10, 10);
  });
  it("returns null when cost is 0 (margin undefined)", () => {
    expect(marginFromCostPrice(0, 50)).toBeNull();
    expect(marginFromCostPrice(0, 0)).toBeNull();
  });
  it("round-trips with priceFromMargin", () => {
    const price = priceFromMargin(137.25, 18);
    expect(marginFromCostPrice(137.25, price)).toBeCloseTo(18, 1);
  });
});

describe("lineTotal", () => {
  it("multiplies unit value by quantity", () => {
    expect(lineTotal(115, 3)).toBe(345);
    expect(lineTotal(0, 5)).toBe(0);
  });
});
