import { describe, it, expect } from "vitest";
import {
  agingBuckets,
  conversionRate,
  countBy,
  growthPct,
  headlineTotal,
  monthlyBuckets,
  num,
  otherCurrencies,
  sumByCurrency,
  topN,
} from "@/lib/analytics";

describe("num", () => {
  it("parses numeric strings", () => {
    expect(num("12.5")).toBe(12.5);
    expect(num("0")).toBe(0);
    expect(num("-3")).toBe(-3);
  });
  it("coerces empty / non-numeric strings to 0", () => {
    expect(num("")).toBe(0);
    expect(num("NaN")).toBe(0);
    expect(num("abc")).toBe(0);
  });
  it("handles null / undefined as 0", () => {
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
  });
  it("passes finite numbers through, non-finite to 0", () => {
    expect(num(42)).toBe(42);
    expect(num(Infinity)).toBe(0);
    expect(num(NaN)).toBe(0);
  });
});

describe("sumByCurrency", () => {
  type Row = { amount: number; currency: string };
  const rows: Row[] = [
    { amount: 1000, currency: "DZD" },
    { amount: 200, currency: "DZD" },
    { amount: 800, currency: "EUR" },
  ];
  const amt = (r: Row) => r.amount;
  const cur = (r: Row) => r.currency;

  it("groups summed amounts by currency code", () => {
    expect(sumByCurrency(rows, amt, cur)).toEqual({ DZD: 1200, EUR: 800 });
  });
  it("falls back to DZD when currency is empty", () => {
    expect(sumByCurrency([{ amount: 50, currency: "" }], amt, cur)).toEqual({
      DZD: 50,
    });
  });
  it("returns an empty map for no rows", () => {
    expect(sumByCurrency([], amt, cur)).toEqual({});
  });
});

describe("headlineTotal", () => {
  it("returns the DZD entry", () => {
    expect(headlineTotal({ DZD: 1200, EUR: 800 })).toBe(1200);
  });
  it("returns 0 when there is no DZD entry", () => {
    expect(headlineTotal({ EUR: 800 })).toBe(0);
    expect(headlineTotal({})).toBe(0);
  });
});

describe("otherCurrencies", () => {
  it("keeps non-DZD currencies with a material total", () => {
    expect(otherCurrencies({ DZD: 1200, EUR: 800 })).toEqual([
      { currency: "EUR", value: 800 },
    ]);
  });
  it("ignores sub-0.005 residuals (float dust)", () => {
    expect(otherCurrencies({ DZD: 1200, EUR: 0.004 })).toEqual([]);
  });
  it("keeps negative currency totals of material magnitude", () => {
    expect(otherCurrencies({ DZD: 1200, USD: -500 })).toEqual([
      { currency: "USD", value: -500 },
    ]);
  });
  it("never surfaces DZD itself", () => {
    expect(otherCurrencies({ DZD: 1200 })).toEqual([]);
  });
});

describe("growthPct", () => {
  it("returns null when there is no baseline and no current value", () => {
    expect(growthPct(0, 0)).toBeNull();
  });
  it("returns 100 when there is no baseline but a current value", () => {
    expect(growthPct(500, 0)).toBe(100);
  });
  it("computes normal growth rounded to 1dp", () => {
    expect(growthPct(150, 100)).toBe(50);
    expect(growthPct(133, 100)).toBe(33);
    // 1/3 growth -> 33.333..% -> rounds to 33.3
    expect(growthPct(400, 300)).toBe(33.3);
  });
  it("computes negative growth and uses |previous| as the denominator", () => {
    expect(growthPct(50, 100)).toBe(-50);
    expect(growthPct(-150, -100)).toBe(-50);
  });
});

describe("conversionRate", () => {
  it("returns 0 when the whole is 0", () => {
    expect(conversionRate(5, 0)).toBe(0);
  });
  it("computes a 0-100 rate rounded to 1dp", () => {
    expect(conversionRate(1, 4)).toBe(25);
    expect(conversionRate(1, 3)).toBe(33.3);
    expect(conversionRate(7, 7)).toBe(100);
  });
});

describe("monthlyBuckets", () => {
  type Row = { date: string; value: number };
  const anchor = new Date(2026, 5, 15); // 15 Jun 2026
  const val = (r: Row) => r.value;
  const dt = (r: Row) => r.date;

  it("renders empty months at zero and returns monthsBack buckets", () => {
    const out = monthlyBuckets<Row>([], dt, val, 6, anchor);
    expect(out).toHaveLength(6);
    expect(out.every((p) => p.value === 0)).toBe(true);
    // chronological: last bucket is the anchor month (June)
    expect(out[5]!.label).toBe("Jun");
    expect(out[0]!.label).toBe("Jan");
  });

  it("buckets rows into their calendar month using the anchor", () => {
    const rows: Row[] = [
      { date: "2026-06-10", value: 100 },
      { date: "2026-06-20", value: 50 },
      { date: "2026-04-01", value: 25 },
    ];
    const out = monthlyBuckets<Row>(rows, dt, val, 6, anchor);
    const june = out.find((p) => p.label === "Jun");
    const april = out.find((p) => p.label === "Apr");
    expect(june!.value).toBe(150);
    expect(april!.value).toBe(25);
  });

  it("buckets correctly across a year boundary", () => {
    const janAnchor = new Date(2026, 0, 15); // 15 Jan 2026
    const rows: Row[] = [
      { date: "2025-12-05", value: 300 }, // Dec 2025 — previous year, in-window
      { date: "2026-01-02", value: 40 },
    ];
    const out = monthlyBuckets<Row>(rows, dt, val, 3, janAnchor);
    // Nov 2025, Dec 2025, Jan 2026
    expect(out).toHaveLength(3);
    expect(out[1]!.label).toBe("Dec");
    expect(out[1]!.value).toBe(300);
    expect(out[2]!.label).toBe("Jan");
    expect(out[2]!.value).toBe(40);
  });

  it("skips rows outside the window and unparseable dates", () => {
    const rows: Row[] = [
      { date: "2020-01-01", value: 999 }, // way before window
      { date: "not-a-date", value: 5 },
    ];
    const out = monthlyBuckets<Row>(rows, dt, val, 6, anchor);
    expect(out.every((p) => p.value === 0)).toBe(true);
  });

  it("rounds bucket values to 2dp", () => {
    const rows: Row[] = [
      { date: "2026-06-01", value: 0.1 },
      { date: "2026-06-02", value: 0.2 },
    ];
    const out = monthlyBuckets<Row>(rows, dt, val, 6, anchor);
    expect(out.find((p) => p.label === "Jun")!.value).toBe(0.3);
  });
});

describe("topN", () => {
  type Row = { key: string | null; value: number };
  const rows: Row[] = [
    { key: "Air Algérie", value: 300 },
    { key: "Air Algérie", value: 200 },
    { key: "Turkish", value: 400 },
    { key: null, value: 100 },
  ];
  const k = (r: Row) => r.key;
  const v = (r: Row) => r.value;

  it("sums by key and sorts descending", () => {
    const out = topN(rows, k, v);
    expect(out[0]).toEqual({ label: "Air Algérie", value: 500 });
    expect(out[1]).toEqual({ label: "Turkish", value: 400 });
  });
  it("uses the fallback label for null/empty keys", () => {
    const out = topN(rows, k, v);
    expect(out.find((p) => p.label === "Unknown")!.value).toBe(100);
  });
  it("respects a custom fallback label", () => {
    const out = topN([{ key: "", value: 10 }], k, v, 8, "N/A");
    expect(out[0]!.label).toBe("N/A");
  });
  it("drops zero-value entries", () => {
    const out = topN([{ key: "Zero", value: 0 }], k, v);
    expect(out).toEqual([]);
  });
  it("limits to n entries", () => {
    const many: Row[] = [
      { key: "a", value: 1 },
      { key: "b", value: 2 },
      { key: "c", value: 3 },
    ];
    expect(topN(many, k, v, 2)).toHaveLength(2);
  });
});

describe("countBy", () => {
  type Row = { key: string | null };
  const rows: Row[] = [{ key: "won" }, { key: "won" }, { key: "lost" }];
  it("counts occurrences per key, sorted desc", () => {
    const out = countBy(rows, (r) => r.key);
    expect(out[0]).toEqual({ label: "won", value: 2 });
    expect(out[1]).toEqual({ label: "lost", value: 1 });
  });
});

describe("agingBuckets", () => {
  const anchor = new Date(2026, 5, 30); // 30 Jun 2026
  const daysBefore = (n: number) =>
    new Date(anchor.getTime() - n * 86_400_000).toISOString();

  it("ignores non-positive balances", () => {
    const out = agingBuckets(
      [
        { balance: 0, refDate: daysBefore(10) },
        { balance: -50, refDate: daysBefore(10) },
      ],
      anchor
    );
    expect(out.every((b) => b.value === 0)).toBe(true);
  });

  it("puts future / missing / unparseable ref dates in 'Not due'", () => {
    const out = agingBuckets(
      [
        { balance: 100, refDate: null },
        { balance: 100, refDate: new Date(anchor.getTime() + 86_400_000) },
        { balance: 100, refDate: "not-a-date" },
      ],
      anchor
    );
    expect(out[0]).toEqual({ label: "Not due", value: 300 });
  });

  it("lands boundary days 30 and 31 in the correct buckets", () => {
    const out = agingBuckets(
      [
        { balance: 10, refDate: daysBefore(30) }, // <=30 -> "0–30d"
        { balance: 20, refDate: daysBefore(31) }, // >30, <=60 -> "31–60d"
      ],
      anchor
    );
    expect(out.find((b) => b.label === "0–30d")!.value).toBe(10);
    expect(out.find((b) => b.label === "31–60d")!.value).toBe(20);
  });

  it("lands boundary days 60 and 61 in the correct buckets", () => {
    const out = agingBuckets(
      [
        { balance: 10, refDate: daysBefore(60) }, // <=60 -> "31–60d"
        { balance: 20, refDate: daysBefore(61) }, // >60 -> "61d+"
      ],
      anchor
    );
    expect(out.find((b) => b.label === "31–60d")!.value).toBe(10);
    expect(out.find((b) => b.label === "61d+")!.value).toBe(20);
  });

  it("exposes the relabeled bucket set in order", () => {
    const out = agingBuckets([], anchor);
    expect(out.map((b) => b.label)).toEqual([
      "Not due",
      "0–30d",
      "31–60d",
      "61d+",
    ]);
  });
});
