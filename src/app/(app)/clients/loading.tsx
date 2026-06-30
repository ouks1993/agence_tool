import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: the Clients page awaits the client list (up to 200 rows)
// plus opportunity counts before rendering, so we show the page shell — header,
// summary card, filter row and table — while that data loads. Mirrors the live
// layout in page.tsx (max-w-6xl, summary card, filters, table).
export default function ClientsLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header — title + description + new-client action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32 shrink-0" />
      </div>

      {/* Summary card — total count + by-status badges */}
      <Card className="card-elevated">
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
          <div className="space-y-2">
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="bg-border hidden h-10 w-px sm:block" />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-6" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Skeleton className="h-9 w-full sm:max-w-xs" />
        <Skeleton className="h-9 w-full sm:max-w-[160px]" />
        <Skeleton className="h-9 w-full sm:max-w-[180px]" />
        <Skeleton className="h-9 w-20" />
      </div>

      {/* Clients table — header bar + ~6 rows */}
      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="divide-y">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="hidden h-4 w-20 sm:block" />
              <div className="flex-1" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
