import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: Flight sourcing awaits the client + open-booking option
// lists before rendering the workspace (flights tab). Mirrors the live layout in
// page.tsx (max-w-5xl, PageHeader, tabbed search panel with a search form grid).
export default function FlightsSourcingLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header — title + description */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Flight search workspace — form grid */}
      <Card className="card-elevated">
        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-9 w-32" />
        </CardContent>
      </Card>
    </div>
  );
}
