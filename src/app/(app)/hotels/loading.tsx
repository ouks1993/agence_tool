import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: Hotels awaits the current-user check + provider config
// before rendering the search experience. Mirrors the live layout in page.tsx
// (container, PageHeader, search panel, results grid).
export default function HotelsLoading() {
  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      {/* Header — title + description + source label */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-4 w-32 shrink-0" />
      </div>

      {/* Search panel — destination, dates, occupancy, submit */}
      <Card className="card-elevated">
        <CardContent className="flex flex-col gap-3 p-5 lg:flex-row lg:items-end">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-full lg:w-40" />
          <Skeleton className="h-9 w-full lg:w-40" />
          <Skeleton className="h-9 w-full lg:w-32" />
        </CardContent>
      </Card>

      {/* Results grid — hotel card placeholders */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="card-elevated overflow-hidden">
            <Skeleton className="h-40 w-full rounded-none" />
            <CardContent className="space-y-2 p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex items-center justify-between pt-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
