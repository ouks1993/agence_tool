import { StatStripSkeleton } from "@/components/app/stat-strip";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: the Support page awaits an agency-wide bookings read
// (up to 500 rows) plus a client list before rendering, so we show the page
// shell — header, KPI strip, action-queue table and the clients/ops grid —
// while that data loads. Mirrors the live layout in page.tsx (max-w-6xl,
// 4-col KPIs, full-width queue table, 2/3 + 1/3 bottom grid).
export default function SupportLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header — title + description + single action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      {/* KPI strip — 4 cells */}
      <StatStripSkeleton cells={4} />

      {/* Action queue — header bar + ~6 rows */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-20" />
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <div className="border-b px-4 py-3">
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="divide-y">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="hidden h-4 w-24 sm:block" />
                  <div className="flex-1" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clients table (2/3) + operations strip (1/3) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-8 w-24" />
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <div className="border-b px-4 py-3">
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="divide-y">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="size-7 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                    <div className="flex-1" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-6" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <li key={i} className="space-y-1.5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
