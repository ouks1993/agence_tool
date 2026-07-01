import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: the booking detail awaits the booking record with items,
// travellers and payments before rendering. Mirrors the live layout in page.tsx
// (max-w-6xl, breadcrumb, header + action row, status sub-line, lifecycle
// stepper, 2/1 grid of content cards + finance sidebar).
export default function BookingDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Breadcrumb */}
      <Skeleton className="h-4 w-48" />

      {/* Header — reference title + action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-40" />
        <div className="flex flex-wrap items-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-24" />
          ))}
        </div>
      </div>

      {/* Status sub-line — badge + facts */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* Lifecycle stepper */}
      <Skeleton className="h-16 w-full rounded-lg" />

      {/* Main grid — content (2 cols) + finance sidebar (1 col) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {[0, 1].map((i) => (
            <Card key={i} className="card-elevated">
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
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
