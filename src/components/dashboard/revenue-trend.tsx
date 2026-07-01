"use client";

import { useState } from "react";
import { AreaInsight, type Point } from "@/components/charts/insight-charts";
import { cn } from "@/lib/utils";

type Series = "revenue" | "bookings";

/**
 * Revenue evolution: a 12-month area chart with a Revenue | Bookings pill toggle
 * that switches the plotted series between confirmed DZD revenue and the
 * confirmed-booking count (both are real monthly buckets computed on the
 * server). The this-month headline + MoM delta live on the hero StatStrip above
 * — repeating them here duplicated the same figure, so the card shows only the
 * toggle + chart under its "Confirmed revenue · last 12 months" subtitle.
 */
export function RevenueTrend({
  data,
  bookingsData,
}: {
  data: Point[];
  /** Confirmed-booking count per month, same window as `data`. */
  bookingsData?: Point[];
}) {
  const [series, setSeries] = useState<Series>("revenue");
  const showBookings = series === "bookings" && bookingsData;

  return (
    <div className="space-y-3">
      {bookingsData && (
        <div className="flex justify-end">
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
        </div>
      )}
      {showBookings ? (
        <AreaInsight data={bookingsData} format="number" color="var(--chart-2)" height={260} />
      ) : (
        <AreaInsight data={data} format="currency" color="var(--chart-1)" height={260} />
      )}
    </div>
  );
}
