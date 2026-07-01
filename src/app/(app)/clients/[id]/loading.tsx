import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: the client profile awaits the client record plus linked
// opportunities, proposals and a unified activity timeline before rendering.
// Mirrors the live layout in page.tsx (max-w-6xl, breadcrumb, profile header
// card, 3-up stat strip, 2/1 grid of tabs + details sidebar).
export default function ClientDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Breadcrumb */}
      <Skeleton className="h-4 w-56" />

      {/* Profile header card */}
      <Card className="card-elevated">
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <Skeleton className="size-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat strip — 3 KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="card-elevated">
            <CardContent className="space-y-2 p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main grid — tabs (2 cols) + details sidebar (1 col) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {/* Tab bar */}
          <div className="bg-muted flex w-full max-w-md gap-1 rounded-md p-1">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-7 flex-1" />
            ))}
          </div>
          <Card className="card-elevated">
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-40 w-full" />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
