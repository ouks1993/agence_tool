import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { AreaInsight, type Point } from "@/components/charts/insight-charts";
import { cn } from "@/lib/utils";

/**
 * Revenue evolution: a headline figure with a month-over-month delta pill over
 * the area chart, matching the mockup's revenue card. The headline value and
 * delta are pre-computed/formatted on the server; the chart uses real DZD
 * monthly buckets.
 */
export function RevenueTrend({
  data,
  headline,
  deltaLabel,
  deltaDirection,
}: {
  data: Point[];
  headline: string;
  deltaLabel?: string;
  deltaDirection?: "up" | "down";
}) {
  const up = deltaDirection === "up";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-bold tracking-tight tabular-nums">
          {headline}
        </span>
        {deltaLabel && deltaDirection && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
              up
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : "bg-destructive/10 text-destructive"
            )}
          >
            {up ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {deltaLabel}
          </span>
        )}
        <span className="text-muted-foreground text-sm">this month</span>
      </div>
      <AreaInsight data={data} format="currency" color="var(--chart-1)" height={260} />
    </div>
  );
}
