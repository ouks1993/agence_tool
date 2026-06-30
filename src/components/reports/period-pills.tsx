import Link from "next/link";
import {
  REPORT_PERIODS,
  REPORT_PERIOD_LABEL,
  type ReportPeriod,
} from "@/lib/reports/period";
import { cn } from "@/lib/utils";

/**
 * Segmented control for the reporting window. Each pill is a real navigation
 * link (`?period=…`) so the server re-scopes the metrics — no client state.
 * Styled to match the Tabs segmented look (muted track, active = card + shadow).
 */
export function PeriodPills({ active }: { active: ReportPeriod }) {
  return (
    <div
      role="tablist"
      aria-label="Reporting period"
      className="bg-muted inline-flex items-center gap-1 rounded-md p-1"
    >
      {REPORT_PERIODS.map((p) => {
        const isActive = p === active;
        return (
          <Link
            key={p}
            href={`/reports?period=${p}`}
            role="tab"
            aria-selected={isActive}
            scroll={false}
            className={cn(
              "rounded-sm px-3 py-1 text-xs font-semibold tracking-tight transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {REPORT_PERIOD_LABEL[p]}
          </Link>
        );
      })}
    </div>
  );
}
