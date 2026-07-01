import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: the supplier detail awaits the supplier record before
// rendering. Mirrors the live layout in page.tsx (max-w-4xl, back link, header,
// type/status badge row, Details card).
export default function SupplierDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      {/* Back link */}
      <Skeleton className="h-8 w-28" />

      {/* Header — name + edit action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-8 w-20" />
      </div>

      {/* Badge row */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>

      {/* Details card */}
      <Card>
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
