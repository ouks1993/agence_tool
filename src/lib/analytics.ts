/**
 * Shared analytics helpers for dashboards (dashboard / finance / opportunities).
 *
 * Design notes:
 * - **Currency:** the agency operates in DZD and we do NOT do FX conversion.
 *   Monetary aggregations therefore work on DZD records only; any record in
 *   another currency is reported separately via `sumByCurrency` so a stray
 *   EUR/USD figure is never silently added to a DZD total. Count-based metrics
 *   (funnels, status breakdowns) are currency-agnostic and include every row.
 * - All functions are pure and return plain numbers / {label,value}[] arrays so
 *   Server Components can compute the data and pass it straight to the (client)
 *   chart primitives without serialization issues.
 */
import type { Point } from "@/components/charts/insight-charts";
import { DEFAULT_CURRENCY } from "@/lib/domain";

export const num = (v: string | number | null | undefined): number => {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  return Number.isFinite(n) ? (n as number) : 0;
};

/** Groups summed amounts by currency code, e.g. { DZD: 1200000, EUR: 800 }. */
export function sumByCurrency<T>(
  rows: T[],
  amountFn: (row: T) => number,
  currencyFn: (row: T) => string
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const cur = currencyFn(r) || DEFAULT_CURRENCY;
    out[cur] = (out[cur] ?? 0) + amountFn(r);
  }
  return out;
}

/** The headline (DZD) total from a sumByCurrency map. */
export function headlineTotal(byCurrency: Record<string, number>): number {
  return byCurrency[DEFAULT_CURRENCY] ?? 0;
}

/** Currencies other than DZD that carry a non-zero total (for "stray currency" chips). */
export function otherCurrencies(
  byCurrency: Record<string, number>
): { currency: string; value: number }[] {
  return Object.entries(byCurrency)
    .filter(([c, v]) => c !== DEFAULT_CURRENCY && Math.abs(v) > 0.005)
    .map(([currency, value]) => ({ currency, value }));
}

/** Month-over-month (or any period) growth as a percentage; null when no baseline. */
export function growthPct(current: number, previous: number): number | null {
  if (!previous) return current ? 100 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

/** Conversion rate as a 0–100 percentage. */
export function conversionRate(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

const SHORT_MONTH = new Intl.DateTimeFormat("en-GB", { month: "short" });

/**
 * Buckets rows into the last `monthsBack` calendar months (chronological),
 * summing `valueFn`. Empty months render at zero so trends never have gaps.
 * `anchor` lets callers pass a fixed "now" for testability.
 */
export function monthlyBuckets<T>(
  rows: T[],
  dateFn: (row: T) => Date | string | null | undefined,
  valueFn: (row: T) => number,
  monthsBack = 6,
  anchor: Date = new Date()
): Point[] {
  const buckets: { key: string; label: string; value: number }[] = [];
  const index = new Map<string, number>();
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    index.set(key, buckets.length);
    buckets.push({ key, label: SHORT_MONTH.format(d), value: 0 });
  }
  for (const r of rows) {
    const raw = dateFn(r);
    if (!raw) continue;
    const d = typeof raw === "string" ? new Date(raw) : raw;
    if (Number.isNaN(d.getTime())) continue;
    const idx = index.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (idx === undefined) continue;
    buckets[idx]!.value += valueFn(r);
  }
  return buckets.map(({ label, value }) => ({
    label,
    value: Math.round(value * 100) / 100,
  }));
}

/** Top-N aggregation by a string key, summing `valueFn`, sorted desc. */
export function topN<T>(
  rows: T[],
  keyFn: (row: T) => string | null | undefined,
  valueFn: (row: T) => number,
  n = 8,
  fallbackLabel = "Unknown"
): Point[] {
  const totals = new Map<string, number>();
  for (const r of rows) {
    const key = keyFn(r)?.trim() || fallbackLabel;
    totals.set(key, (totals.get(key) ?? 0) + valueFn(r));
  }
  return [...totals.entries()]
    .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }))
    .filter((p) => p.value !== 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

/** Counts rows by a string key (currency-agnostic), sorted desc. */
export function countBy<T>(
  rows: T[],
  keyFn: (row: T) => string | null | undefined,
  n = 8,
  fallbackLabel = "Unknown"
): Point[] {
  return topN(rows, keyFn, () => 1, n, fallbackLabel);
}

/**
 * Buckets outstanding balances into AR aging windows by days overdue from a
 * reference (departure) date. Negative/zero balances are ignored by the caller.
 */
export function agingBuckets(
  rows: { balance: number; refDate: Date | string | null | undefined }[],
  anchor: Date = new Date()
): Point[] {
  const buckets = [
    { label: "Not due", value: 0 },
    { label: "0–30d", value: 0 },
    { label: "31–60d", value: 0 },
    { label: "61d+", value: 0 },
  ];
  for (const r of rows) {
    if (r.balance <= 0.005) continue;
    const ref = r.refDate
      ? typeof r.refDate === "string"
        ? new Date(r.refDate)
        : r.refDate
      : null;
    if (!ref || Number.isNaN(ref.getTime()) || ref.getTime() > anchor.getTime()) {
      buckets[0]!.value += r.balance;
      continue;
    }
    const days = Math.floor((anchor.getTime() - ref.getTime()) / 86_400_000);
    const idx = days <= 30 ? 1 : days <= 60 ? 2 : 3;
    buckets[idx]!.value += r.balance;
  }
  return buckets.map((b) => ({ label: b.label, value: Math.round(b.value * 100) / 100 }));
}
