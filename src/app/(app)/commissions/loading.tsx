import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: the Commissions page awaits commission rows and a
// per-currency summary before rendering. Mirrors page.tsx — header + action,
// a 3-up summary strip, a filter row, and the commissions table.
export default function CommissionsLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header — title + description + record action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-40 shrink-0" />
      </div>

      {/* Summary strip — one row of three StatCard placeholders */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="card-elevated">
            <CardContent className="space-y-2 p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters — type / status / from / to / submit */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <Skeleton className="h-9 w-full sm:w-[200px]" />
        <Skeleton className="h-9 w-full sm:w-[160px]" />
        <Skeleton className="h-9 w-full sm:w-[160px]" />
        <Skeleton className="h-9 w-full sm:w-[160px]" />
        <Skeleton className="h-9 w-20" />
      </div>

      {/* Commissions table — header bar + ~6 rows */}
      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="divide-y">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="hidden h-4 w-28 sm:block" />
              <div className="flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
