import { DonutInsight, type Point } from "@/components/charts/insight-charts";

/**
 * Bookings-by-status donut plus two summary figures (outstanding balance and
 * average booking value), mirroring the mockup's right-hand card. All amounts
 * are pre-formatted DZD strings computed on the server.
 */
export function BookingsStatusPanel({
  data,
  outstanding,
  avgBookingValue,
}: {
  data: Point[];
  outstanding: string;
  avgBookingValue: string;
}) {
  return (
    <div className="space-y-4">
      <DonutInsight data={data} height={180} />
      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Outstanding balance</span>
          <span className="text-sm font-semibold tabular-nums">{outstanding}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Avg. booking value</span>
          <span className="text-sm font-semibold tabular-nums">{avgBookingValue}</span>
        </div>
      </div>
    </div>
  );
}
