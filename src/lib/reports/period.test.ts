import { describe, it, expect } from "vitest";
import {
  DEFAULT_PERIOD,
  inWindow,
  parsePeriod,
  REPORT_PERIODS,
  resolvePeriodWindow,
  type ReportPeriod,
} from "@/lib/reports/period";

// Fixed anchor: 15 May 2026, 12:00 local. Mid-month, mid-quarter (Q2), mid-year
// so MTD/QTD/YTD are all genuinely partial windows.
const ANCHOR = new Date(2026, 4, 15, 12, 0, 0);
const DAY = 86_400_000;

describe("parsePeriod", () => {
  it("passes through known periods", () => {
    for (const period of REPORT_PERIODS) {
      expect(parsePeriod(period)).toBe(period);
    }
  });
  it("defaults unknown / undefined values", () => {
    expect(parsePeriod(undefined)).toBe(DEFAULT_PERIOD);
    expect(parsePeriod("bogus")).toBe(DEFAULT_PERIOD);
  });
  it("takes the first element of an array param", () => {
    expect(parsePeriod(["qtd", "30d"])).toBe("qtd");
    expect(parsePeriod(["bogus"])).toBe(DEFAULT_PERIOD);
  });
});

describe("inWindow (half-open [from, to))", () => {
  const from = new Date(2026, 0, 1);
  const to = new Date(2026, 1, 1);
  it("includes the inclusive start", () => {
    expect(inWindow(from, from, to)).toBe(true);
  });
  it("excludes the exclusive end", () => {
    expect(inWindow(to, from, to)).toBe(false);
  });
  it("includes a point strictly inside", () => {
    expect(inWindow(new Date(2026, 0, 15), from, to)).toBe(true);
  });
  it("accepts ISO strings", () => {
    expect(inWindow("2026-01-10T00:00:00", from, to)).toBe(true);
  });
  it("rejects null / undefined / unparseable dates", () => {
    expect(inWindow(null, from, to)).toBe(false);
    expect(inWindow(undefined, from, to)).toBe(false);
    expect(inWindow("not-a-date", from, to)).toBe(false);
  });
});

describe("resolvePeriodWindow", () => {
  it("ends every current window at the anchor (to === anchor)", () => {
    for (const period of REPORT_PERIODS) {
      expect(resolvePeriodWindow(period, ANCHOR).to).toBe(ANCHOR);
    }
  });

  it("makes the previous window contiguous with the current (prevTo <= from)", () => {
    for (const period of REPORT_PERIODS) {
      const w = resolvePeriodWindow(period, ANCHOR);
      expect(w.prevTo.getTime()).toBeLessThanOrEqual(w.from.getTime());
      expect(w.prevFrom.getTime()).toBeLessThan(w.prevTo.getTime());
    }
  });

  describe("fixed-length periods: prev window has equal span", () => {
    const expectEqualSpan = (period: ReportPeriod) => {
      const w = resolvePeriodWindow(period, ANCHOR);
      const cur = w.to.getTime() - w.from.getTime();
      const prev = w.prevTo.getTime() - w.prevFrom.getTime();
      expect(prev).toBe(cur);
    };

    it("30d prev spans the same length and abuts from", () => {
      const w = resolvePeriodWindow("30d", ANCHOR);
      expect(w.prevTo).toEqual(w.from);
      expectEqualSpan("30d");
    });
  });

  describe("to-date periods compare the same elapsed length", () => {
    const expectSameElapsed = (period: ReportPeriod) => {
      const w = resolvePeriodWindow(period, ANCHOR);
      const elapsed = w.to.getTime() - w.from.getTime();
      const prevElapsed = w.prevTo.getTime() - w.prevFrom.getTime();
      expect(prevElapsed).toBe(elapsed);
    };

    it("mtd previous window matches elapsed month-to-date length", () => {
      const w = resolvePeriodWindow("mtd", ANCHOR);
      expect(w.from).toEqual(new Date(2026, 4, 1)); // 1 May
      expect(w.prevFrom).toEqual(new Date(2026, 3, 1)); // 1 Apr
      expectSameElapsed("mtd");
    });

    it("qtd previous window matches elapsed quarter-to-date length", () => {
      const w = resolvePeriodWindow("qtd", ANCHOR);
      expect(w.from).toEqual(new Date(2026, 3, 1)); // Q2 starts 1 Apr
      expect(w.prevFrom).toEqual(new Date(2026, 0, 1)); // Q1 starts 1 Jan
      expectSameElapsed("qtd");
    });

    it("ytd previous window matches elapsed year-to-date length", () => {
      const w = resolvePeriodWindow("ytd", ANCHOR);
      expect(w.from).toEqual(new Date(2026, 0, 1)); // 1 Jan 2026
      expect(w.prevFrom).toEqual(new Date(2025, 0, 1)); // 1 Jan 2025
      expectSameElapsed("ytd");
    });
  });

  describe("12m (default) trailing whole months", () => {
    it("starts 11 whole months before the anchor month", () => {
      const w = resolvePeriodWindow("12m", ANCHOR);
      // anchor May 2026 -> from = 1 Jun 2025
      expect(w.from).toEqual(new Date(2025, 5, 1));
      // prev block is the 12 months before that: 1 Jun 2024
      expect(w.prevFrom).toEqual(new Date(2024, 5, 1));
      expect(w.prevTo).toEqual(w.from);
      expect(w.months).toBe(12);
    });

    it("is the default when the period is unspecified", () => {
      expect(DEFAULT_PERIOD).toBe("12m");
    });
  });

  it("reports a plausible months span per period", () => {
    expect(resolvePeriodWindow("30d", ANCHOR).months).toBe(2);
    expect(resolvePeriodWindow("mtd", ANCHOR).months).toBe(2);
    expect(resolvePeriodWindow("qtd", ANCHOR).months).toBe(4);
    expect(resolvePeriodWindow("ytd", ANCHOR).months).toBe(12);
    expect(resolvePeriodWindow("12m", ANCHOR).months).toBe(12);
  });

  it("30d window starts at the start of the day 30 days back", () => {
    const w = resolvePeriodWindow("30d", ANCHOR);
    const back = new Date(ANCHOR.getTime() - 30 * DAY);
    expect(w.from).toEqual(
      new Date(back.getFullYear(), back.getMonth(), back.getDate())
    );
  });
});
