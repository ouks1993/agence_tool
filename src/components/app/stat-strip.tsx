import { Fragment } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { StatDelta } from "@/components/app/stat-card";

/** One KPI cell in a {@link StatStrip}. */
export type StatStripItem = {
  label: string;
  value: string | number;
  /** Optional value colour, e.g. "text-success" for a positive headline. */
  tone?: string;
  /** Optional trend pill shown beside the value. Caption is omitted in the strip. */
  delta?: StatDelta;
};

/**
 * A unified, compact KPI band: one elevated card, uppercase micro-labels,
 * tabular-nums values, and thin vertical dividers between cells — matching the
 * marketing deck's pipeline summary strip. Replaces grids of separate StatCards
 * for a single, consistent KPI treatment app-wide. Pass compact money values
 * (formatMoneyCompact) so cells stay tight.
 */
export function StatStrip({
  items,
  className,
}: {
  items: StatStripItem[];
  className?: string;
}) {
  return (
    <Card className={cn("card-elevated", className)}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 px-5 py-4 sm:gap-x-8 sm:px-6">
        {items.map((item, i) => {
          const up = item.delta?.direction === "up";
          return (
            <Fragment key={`${item.label}-${i}`}>
              {i > 0 && (
                <div
                  aria-hidden
                  className="hidden h-9 w-px shrink-0 self-center bg-border sm:block"
                />
              )}
              <div className="min-w-[110px]">
                <div className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  {item.label}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      "text-[19px] leading-tight font-bold tracking-[-0.02em] tabular-nums text-foreground",
                      item.tone
                    )}
                  >
                    {item.value}
                  </span>
                  {item.delta && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                        up
                          ? "bg-success-soft text-success"
                          : "bg-destructive/10 text-destructive"
                      )}
                    >
                      {up ? (
                        <ArrowUpRight className="size-3" />
                      ) : (
                        <ArrowDownRight className="size-3" />
                      )}
                      {item.delta.value}
                    </span>
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
    </Card>
  );
}

/** Loading placeholder that mirrors the StatStrip layout (no reflow on load). */
export function StatStripSkeleton({ cells = 4 }: { cells?: number }) {
  return (
    <Card className="card-elevated">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 px-5 py-4 sm:gap-x-8 sm:px-6">
        {Array.from({ length: cells }).map((_, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <div
                aria-hidden
                className="hidden h-9 w-px shrink-0 self-center bg-border sm:block"
              />
            )}
            <div className="min-w-[110px] space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-24" />
            </div>
          </Fragment>
        ))}
      </div>
    </Card>
  );
}
