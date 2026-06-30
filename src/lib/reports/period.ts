/**
 * Reporting period windows for the Reports & analytics screen.
 *
 * The Reports page is a Server Component that scopes its metrics to a window
 * chosen via a `?period=` search param (so the pills are plain links — no
 * client state). Each window also yields a matching *previous* window of the
 * same length so KPI deltas ("vs previous period") are computed against a
 * like-for-like baseline.
 *
 * All windows are half-open ranges `[from, to)` in the server's local time,
 * which matches how the rest of the app buckets `createdAt` (see analytics.ts).
 */

export const REPORT_PERIODS = ["30d", "mtd", "qtd", "12m", "ytd"] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export const DEFAULT_PERIOD: ReportPeriod = "12m";

/** Human labels for the segmented control + subtitle copy. */
export const REPORT_PERIOD_LABEL: Record<ReportPeriod, string> = {
  "30d": "30D",
  mtd: "MTD",
  qtd: "QTD",
  "12m": "12M",
  ytd: "YTD",
};

/** Subtitle phrase describing the active window, e.g. "trailing 12 months". */
export const REPORT_PERIOD_PHRASE: Record<ReportPeriod, string> = {
  "30d": "last 30 days",
  mtd: "month to date",
  qtd: "quarter to date",
  "12m": "trailing 12 months",
  ytd: "year to date",
};

/** Narrows an arbitrary search-param value to a known period (defaulting). */
export function parsePeriod(value: string | string[] | undefined): ReportPeriod {
  const v = Array.isArray(value) ? value[0] : value;
  return REPORT_PERIODS.includes(v as ReportPeriod)
    ? (v as ReportPeriod)
    : DEFAULT_PERIOD;
}

export type PeriodWindow = {
  /** Inclusive start of the current window. */
  from: Date;
  /** Exclusive end of the current window (≈ now). */
  to: Date;
  /** Inclusive start of the immediately preceding window of equal span. */
  prevFrom: Date;
  /** Exclusive end of the preceding window (== `from`). */
  prevTo: Date;
  /** Whole calendar months spanned by the window — drives the trend chart. */
  months: number;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfQuarter = (d: Date) =>
  new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);

/**
 * Resolves a period into current + previous windows.
 *
 * "to-date" windows (MTD / QTD / YTD) compare against the *same elapsed length*
 * of the prior period so a partial month isn't unfairly compared to a full one.
 */
export function resolvePeriodWindow(
  period: ReportPeriod,
  anchor: Date = new Date()
): PeriodWindow {
  const to = anchor;

  switch (period) {
    case "30d": {
      const from = startOfDay(new Date(anchor.getTime() - 30 * 86_400_000));
      const span = to.getTime() - from.getTime();
      return {
        from,
        to,
        prevFrom: new Date(from.getTime() - span),
        prevTo: from,
        months: 2,
      };
    }
    case "mtd": {
      const from = startOfMonth(anchor);
      const elapsed = to.getTime() - from.getTime();
      const prevFrom = startOfMonth(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1));
      return {
        from,
        to,
        prevFrom,
        prevTo: new Date(prevFrom.getTime() + elapsed),
        months: 2,
      };
    }
    case "qtd": {
      const from = startOfQuarter(anchor);
      const elapsed = to.getTime() - from.getTime();
      const prevFrom = startOfQuarter(new Date(anchor.getFullYear(), anchor.getMonth() - 3, 1));
      return {
        from,
        to,
        prevFrom,
        prevTo: new Date(prevFrom.getTime() + elapsed),
        months: 4,
      };
    }
    case "ytd": {
      const from = startOfYear(anchor);
      const elapsed = to.getTime() - from.getTime();
      const prevFrom = startOfYear(new Date(anchor.getFullYear() - 1, 0, 1));
      return {
        from,
        to,
        prevFrom,
        prevTo: new Date(prevFrom.getTime() + elapsed),
        months: 12,
      };
    }
    case "12m":
    default: {
      // Trailing 12 whole months ending with the current month.
      const from = startOfMonth(new Date(anchor.getFullYear(), anchor.getMonth() - 11, 1));
      const prevFrom = startOfMonth(new Date(anchor.getFullYear(), anchor.getMonth() - 23, 1));
      return {
        from,
        to,
        prevFrom,
        prevTo: from,
        months: 12,
      };
    }
  }
}

/** True when `date` falls in the half-open window `[from, to)`. */
export function inWindow(
  date: Date | string | null | undefined,
  from: Date,
  to: Date
): boolean {
  if (!date) return false;
  const t = (typeof date === "string" ? new Date(date) : date).getTime();
  if (Number.isNaN(t)) return false;
  return t >= from.getTime() && t < to.getTime();
}
