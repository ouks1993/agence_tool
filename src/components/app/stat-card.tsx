import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { SparkLine } from "@/components/charts/insight-charts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Optional trend indicator shown as a coloured pill next to the value. */
export type StatDelta = {
  /** Display text, e.g. "+12%" or "+3 this week". */
  value: string;
  /** Direction drives colour + arrow. "up" is green, "down" is red. */
  direction: "up" | "down";
  /** Trailing context, e.g. "vs last month". */
  caption?: string;
};

export function StatCard({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  spark,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  delta?: StatDelta;
  icon?: React.ComponentType<{ className?: string }>;
  /** Optional trailing micro-trend series rendered bottom-right as a sparkline. */
  spark?: number[];
  className?: string;
}) {
  const up = delta?.direction === "up";
  // Colour the spark by delta direction when known, else neutral brand.
  const sparkColor = delta
    ? up
      ? "var(--chart-2)"
      : "var(--destructive)"
    : "var(--chart-1)";
  return (
    <Card className={cn("card-interactive card-elevated relative overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm font-medium">{label}</p>
            <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
            {delta ? (
              <div className="flex items-center gap-1.5 pt-0.5 text-xs">
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular-nums",
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
                  {delta.value}
                </span>
                {delta.caption && (
                  <span className="text-muted-foreground">{delta.caption}</span>
                )}
              </div>
            ) : (
              hint && <p className="text-muted-foreground text-xs">{hint}</p>
            )}
          </div>
          {Icon && (
            <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
              <Icon className="size-5" />
            </div>
          )}
        </div>
        {spark && spark.length >= 2 && (
          <div className="pointer-events-none absolute right-3 bottom-3 opacity-80">
            <SparkLine data={spark} color={sparkColor} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
