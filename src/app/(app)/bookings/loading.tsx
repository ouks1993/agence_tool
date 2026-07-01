import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function BookingsLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header — title + description + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      {/* KPI strip — 4 StatCard placeholders */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="card-elevated">
            <CardContent className="space-y-2 p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bookings table — 7-column header + ~7 rows matching the real grid */}
      <div className="overflow-hidden rounded-lg border">
        {/* Header band */}
        <div className="bg-surface-2 grid grid-cols-[1fr_1.2fr_1fr_1.4fr_0.6fr_1fr_1fr] gap-4 border-b px-4 py-3">
          {["ref", "client", "dest", "dates", "pax", "status", "total"].map((k, i) => (
            <Skeleton
              key={k}
              className={`h-3 ${
                i === 4 || i === 6 ? "ml-auto w-10" : "w-20"
              }`}
            />
          ))}
        </div>
        <div className="divide-y">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_1.2fr_1fr_1.4fr_0.6fr_1fr_1fr] items-center gap-4 px-4 py-3"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="ml-auto h-4 w-8" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
