import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: Billing awaits an admin check + the agency subscription
// record before rendering. Mirrors the live layout in page.tsx (max-w-6xl shell,
// PageHeader, single max-w-2xl elevated Subscription card).
export default function BillingLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header — title + description */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="mx-auto w-full max-w-2xl">
        {/* Subscription card — title + status badge, description, action row */}
        <Card className="card-elevated">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="size-5 rounded-md" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-9 w-40" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
