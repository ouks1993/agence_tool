import { StatStripSkeleton } from "@/components/app/stat-strip";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: the Opportunities page awaits an agency-wide pipeline
// query (up to 500 rows) before rendering, so we show the page shell — header,
// 5-up KPI strip, funnel chart and pipeline board — while that data loads.
// Mirrors the live layout in page.tsx (max-w-[100rem], 5-col KPIs, kanban board).
export default function OpportunitiesLoading() {
  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6 px-4 py-8 sm:px-6">
      {/* Breadcrumb */}
      <Skeleton className="h-4 w-40" />

      {/* Header — title + description + action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-40 shrink-0" />
      </div>

      {/* KPI strip — 5-cell StatStrip placeholder (matches page.tsx) */}
      <StatStripSkeleton cells={5} />

      {/* Conversion funnel card */}
      <Card className="card-elevated">
        <CardHeader>
          <Skeleton className="h-5 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>

      {/* Pipeline board — horizontal-scroll flex row mirroring the live board
          (5 open+won lanes of fixed w-[19rem] on bg-muted/40, not bordered). */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[0, 1, 2, 3, 4].map((col) => (
          <div key={col} className="w-[19rem] shrink-0 space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
            <div className="bg-muted/40 space-y-2 rounded-lg p-2">
              {[0, 1].map((card) => (
                <div key={card} className="bg-card space-y-2.5 rounded-lg border p-3 shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <Skeleton className="size-7 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
