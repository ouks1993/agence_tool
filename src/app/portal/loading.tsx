import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: the guest portal home awaits the portal session, the
// traveller's bookings and any pending proposal before rendering. The portal
// layout already provides the max-w-5xl main wrapper, so this only mirrors the
// inner content (welcome, trip hero, 2-column trips + rail).
export default function PortalLoading() {
  return (
    <div className="space-y-7">
      {/* Welcome */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Trip hero */}
      <Skeleton className="h-56 w-full rounded-lg" />

      {/* Two-column layout with ~340px right rail */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_340px]">
        {/* Main column — trip cards */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
              <Skeleton className="size-12 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <Card className="card-elevated">
            <CardContent className="space-y-3 p-5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
