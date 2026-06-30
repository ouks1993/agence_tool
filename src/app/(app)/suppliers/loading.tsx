import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: the Suppliers page awaits getSuppliers() before
// rendering, so we show the page shell — header, filter bar and the suppliers
// table — while that data loads. Mirrors the live layout in page.tsx
// (max-w-6xl, filter row, 5-column table).
export default function SuppliersLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header — title + description + action button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      {/* Filters — search input + two selects + filter button */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Skeleton className="h-9 w-full sm:max-w-xs" />
        <Skeleton className="h-9 w-full sm:max-w-[180px]" />
        <Skeleton className="h-9 w-full sm:max-w-[160px]" />
        <Skeleton className="h-9 w-20" />
      </div>

      {/* Suppliers table — header bar + ~6 rows */}
      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="divide-y">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="hidden h-5 w-24 rounded-full sm:block" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <div className="flex-1" />
              <Skeleton className="hidden h-4 w-28 sm:block" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
