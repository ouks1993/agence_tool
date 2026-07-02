import { describe, it, expect } from "vitest";
import { formatMoney, formatMoneyCompact } from "@/lib/format";

// Currency glyphs/placement vary by ICU version, so assertions target stable
// structural properties (digits, grouping, currency token, negative sign)
// rather than an exact rendered string.

describe("formatMoney", () => {
  it("formats a DZD amount with grouping and the DZD token", () => {
    const out = formatMoney(1234567); // default currency = DZD
    expect(out).toContain("DZD");
    expect(out).toContain("1,234,567");
  });

  it("formats an EUR amount with the euro symbol", () => {
    const out = formatMoney(1200, "EUR");
    expect(out).toContain("€");
    expect(out).toContain("1,200");
  });

  it("parses a numeric string", () => {
    expect(formatMoney("2500")).toContain("2,500");
  });

  it("treats null / undefined / empty as 0", () => {
    for (const input of [null, undefined, ""] as const) {
      const out = formatMoney(input);
      expect(out).toContain("0");
      expect(out).toContain("DZD");
    }
  });

  it("coerces a non-finite / malformed amount to 0", () => {
    expect(formatMoney("not-a-number")).toContain("0");
    expect(formatMoney(Infinity)).toContain("0");
  });

  it("keeps at most two fraction digits", () => {
    // 10.999 -> rounds to 11.00 (max 2 fraction digits, no half-up surprises)
    const out = formatMoney(10.999, "EUR");
    expect(out).toContain("11");
  });

  it("renders negative amounts with a sign", () => {
    const out = formatMoney(-500, "EUR");
    expect(out).toContain("500");
    expect(out).toMatch(/-|\(/); // minus sign or accounting parens
  });

  it("falls back to '<value> <code>' for an unknown currency code", () => {
    // An invalid ISO code makes Intl throw; the catch path formats plainly.
    expect(formatMoney(1000, "NOTACODE")).toBe("1000.00 NOTACODE");
  });
});

describe("formatMoneyCompact", () => {
  it("compacts millions and suffixes the currency code", () => {
    // NOTE: en-GB compact notation renders a lowercase magnitude suffix ("m"),
    // not the uppercase "42.8M" shown in the DESIGN.md docstring example. We
    // assert the actual ICU output here; see report for the doc discrepancy.
    const out = formatMoneyCompact(42_800_000);
    expect(out).toContain("42.8m");
    expect(out).toContain("DZD");
  });

  it("compacts thousands", () => {
    expect(formatMoneyCompact(12_500, "EUR")).toContain("EUR");
    expect(formatMoneyCompact(12_500, "EUR")).toMatch(/12\.5k|13k|12k/);
  });

  it("treats null / undefined as 0", () => {
    expect(formatMoneyCompact(null)).toContain("0");
    expect(formatMoneyCompact(undefined)).toContain("DZD");
  });

  it("coerces a malformed string to 0", () => {
    expect(formatMoneyCompact("abc")).toContain("0");
  });
});
