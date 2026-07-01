import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: Search awaits the client + open-booking option lists
// before rendering the workspace. Mirrors the live layout in page.tsx
// (max-w-5xl, PageHeader, tabbed search panel with a search form grid).
export default function SearchLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header — title + description */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Search workspace — vertical tabs + search form */}
      <Card className="card-elevated">
        <CardContent className="space-y-4 p-5">
          {/* Tab bar (Flights / Hotels) */}
          <div className="bg-muted flex w-fit gap-1 rounded-md p-1">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-7 w-24" />
          </div>
          {/* Search form grid */}
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
