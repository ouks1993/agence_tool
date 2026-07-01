import { StatStripSkeleton } from "@/components/app/stat-strip";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: the platform console awaits the agency list plus grouped
// user/client/booking counts before rendering. Mirrors the live layout in
// page.tsx (max-w-6xl, PageHeader + new-agency action, KPI grid, filters +
// agencies table card).
export default function PlatformLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header — title + description + new-agency action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32 shrink-0" />
      </div>

      {/* KPI strip — 4 cells */}
      <StatStripSkeleton cells={4} />

      {/* Filters — search + status select */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Skeleton className="h-9 w-full sm:max-w-xs sm:flex-1" />
        <Skeleton className="h-9 w-full sm:max-w-[180px]" />
      </div>

      {/* Agencies table card — header band + rows */}
      <div className="overflow-hidden rounded-lg border">
        <div className="bg-surface-2 border-b px-4 py-3">
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <div className="divide-y">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="hidden h-4 w-10 sm:block" />
              <Skeleton className="hidden h-4 w-10 sm:block" />
              <Skeleton className="hidden h-4 w-10 sm:block" />
              <Skeleton className="size-8 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
