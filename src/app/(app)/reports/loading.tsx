import { ReportsAnalyticsSkeleton } from "@/components/reports/reports-analytics";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: Reports awaits the current-user + finance-permission
// check before the shell renders (the analytics section itself streams via
// <Suspense> once the shell is up). Mirrors the live layout in page.tsx
// (max-w-6xl, breadcrumb, header + period pills, analytics grid, export block).
export default function ReportsLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Breadcrumb */}
      <Skeleton className="h-4 w-56" />

      {/* Header — title + subtitle on the left, period pills + export on the right */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-8 w-64 rounded-full" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      {/* Analytics dashboard — shared with the page's <Suspense> fallback */}
      <ReportsAnalyticsSkeleton />

      {/* Export section */}
      <section className="space-y-4 pt-2">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </section>
    </div>
  );
}
