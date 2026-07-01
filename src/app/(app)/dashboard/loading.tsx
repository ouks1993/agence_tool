import { StatStripSkeleton } from "@/components/app/stat-strip";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Card shell skeleton matching SectionCard (header bar + body). */
function CardSkeleton({ bodyHeight = "h-48" }: { bodyHeight?: string }) {
  return (
    <Card className="card-elevated overflow-hidden">
      <div className="border-b px-5 py-4">
        <Skeleton className="h-5 w-40" />
      </div>
      <CardContent className="p-5">
        <Skeleton className={`w-full ${bodyHeight}`} />
      </CardContent>
    </Card>
  );
}

export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Hero KPI row */}
      <StatStripSkeleton cells={4} />

      {/* Row 1 — revenue (2fr) + bookings by status (1fr) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CardSkeleton bodyHeight="h-64" />
        </div>
        <CardSkeleton bodyHeight="h-64" />
      </div>

      {/* Row 2 — funnel + departures + follow-ups */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      {/* Recent activity */}
      <Card className="card-elevated">
        <CardContent className="space-y-3 p-6">
          <Skeleton className="h-6 w-36" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-7 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
