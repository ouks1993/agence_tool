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

      {/* KPI strip — 5 StatCard placeholders */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Card key={i} className="card-elevated">
            <CardContent className="space-y-2 p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Conversion funnel card */}
      <Card className="card-elevated">
        <CardHeader>
          <Skeleton className="h-5 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>

      {/* Pipeline board — row of column placeholders */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((col) => (
          <div key={col} className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-8" />
            </div>
            {[0, 1, 2].map((card) => (
              <Card key={card} className="card-elevated">
                <CardContent className="space-y-2 p-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
