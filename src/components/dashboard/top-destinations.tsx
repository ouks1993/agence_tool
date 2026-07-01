import type { Point } from "@/components/charts/insight-charts";

export type DestinationRow = Point & {
  /** Pre-formatted compact money, e.g. "11.2M DZD". */
  display: string;
  /** Share of the window's total revenue, 0–100 (already rounded). */
  share: number;
};

/**
 * Compact "Top destinations · by revenue this month" card body — progress-bar
 * rows built from REAL booking revenue by destination (currency-safe: the
 * caller passes a single-currency, DZD-only series). The widest bar is the
 * top destination; every other bar is scaled relative to it.
 */
export function TopDestinations({ rows }: { rows: DestinationRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-2 text-sm">
        No destination revenue this month yet.
      </p>
    );
  }
  const top = rows[0]?.value || 1;
  return (
    <div className="flex flex-col gap-3.5">
      {rows.map((r) => (
        <div key={r.label} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium">{r.label}</span>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {r.share}% · {r.display}
            </span>
          </div>
          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full"
              style={{ width: `${Math.max((r.value / top) * 100, 4)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
