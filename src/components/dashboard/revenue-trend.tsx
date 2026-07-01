"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { AreaInsight, type Point } from "@/components/charts/insight-charts";
import { cn } from "@/lib/utils";

type Series = "revenue" | "bookings";

/**
 * Revenue evolution: a headline figure with a month-over-month delta pill over
 * the area chart, matching the mockup's revenue card. A Revenue | Bookings pill
 * toggle switches the plotted series between confirmed DZD revenue and the
 * confirmed-booking count (both are real monthly buckets computed on the
 * server). The headline/delta reflect the revenue series (money is the primary
 * KPI); switching to Bookings shows the count trend.
 */
export function RevenueTrend({
  data,
  bookingsData,
  headline,
  deltaLabel,
  deltaDirection,
}: {
  data: Point[];
  /** Confirmed-booking count per month, same window as `data`. */
  bookingsData?: Point[];
  headline: string;
  deltaLabel?: string;
  deltaDirection?: "up" | "down";
}) {
  const [series, setSeries] = useState<Series>("revenue");
  const up = deltaDirection === "up";
  const showBookings = series === "bookings" && bookingsData;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-2xl font-bold tracking-tight tabular-nums">
            {headline}
          </span>
          {deltaLabel && deltaDirection && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
                up
                  ? "bg-success-soft text-success"
                  : "bg-danger-soft text-danger"
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
        {bookingsData && (
          <div className="bg-muted inline-flex rounded-md p-0.5 text-xs font-medium">
            {(["revenue", "bookings"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeries(s)}
                className={cn(
                  "rounded-[6px] px-2.5 py-1 capitalize transition-colors",
                  series === s
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      {showBookings ? (
        <AreaInsight data={bookingsData} format="number" color="var(--chart-2)" height={260} />
      ) : (
        <AreaInsight data={data} format="currency" color="var(--chart-1)" height={260} />
      )}
    </div>
  );
}
