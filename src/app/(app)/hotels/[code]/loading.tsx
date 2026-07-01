import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: hotel details await cached/live Hotelbeds content plus
// draft proposals, client and open-booking option lists before rendering.
// Mirrors the live layout in page.tsx (container, back link, photo gallery,
// 2/1 grid of room list + booking sidebar).
export default function HotelDetailsLoading() {
  return (
    <div className="container mx-auto space-y-5 px-4 py-8">
      {/* Back link */}
      <Skeleton className="h-8 w-36" />

      {/* Title + location */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Photo gallery */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:grid-rows-2">
        <Skeleton className="h-48 w-full sm:col-span-2 sm:row-span-2 sm:h-full" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="hidden h-full min-h-24 w-full sm:block" />
        ))}
      </div>

      {/* Main grid — rooms (2 cols) + booking sidebar (1 col) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="card-elevated">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-9 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          <Card className="card-elevated">
            <CardContent className="space-y-3 p-5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
