import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: the supplier detail awaits the supplier record before
// rendering. Mirrors the live layout in page.tsx (max-w-4xl, breadcrumb,
// profile-header card with avatar + stat strip, Details card).
export default function SupplierDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      {/* Breadcrumb + edit action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-8 w-28" />
      </div>

      {/* Profile header — avatar, name, badges + stat strip */}
      <Card className="card-elevated overflow-hidden">
        <div className="flex flex-col gap-4 border-b px-6 py-5 sm:flex-row sm:items-center">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-56" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2 p-4">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </Card>

      {/* Details card */}
      <Card className="card-elevated">
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-4 w-64" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
