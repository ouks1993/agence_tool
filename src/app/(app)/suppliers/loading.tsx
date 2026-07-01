import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: the Suppliers page awaits getSuppliers() before
// rendering. Mirrors the live layout in page.tsx (max-w-6xl, summary strip,
// filter row, and the card-elevated 5-column table).
export default function SuppliersLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header — title + description + action button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32 shrink-0" />
      </div>

      {/* Summary strip */}
      <Card className="card-elevated">
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
          <div className="space-y-2">
            <Skeleton className="h-7 w-10" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="bg-border hidden h-10 w-px sm:block" />
          <div className="flex items-center gap-6">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </CardContent>
      </Card>

      {/* Filters — search input + two selects + filter button */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Skeleton className="h-9 w-full sm:max-w-xs" />
        <Skeleton className="h-9 w-full sm:max-w-[180px]" />
        <Skeleton className="h-9 w-full sm:max-w-[160px]" />
        <Skeleton className="h-9 w-20" />
      </div>

      {/* Suppliers table — card-elevated wrapper, 5-column header + rows */}
      <Card className="card-elevated overflow-hidden p-0">
        {/* Header band — 5 column labels */}
        <div className="bg-surface-2 flex items-center gap-4 border-b px-4 py-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
          <div className="flex-1" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="divide-y">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <div className="flex-1" />
              <Skeleton className="hidden h-4 w-28 sm:block" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
