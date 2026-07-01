import { StatStripSkeleton } from "@/components/app/stat-strip";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: the Team page awaits several agency-scoped queries
// (members, pending invites, per-agent aggregates, recent activity) before
// rendering, so we show the page shell while that data loads. Mirrors the live
// layout in page.tsx (max-w-6xl, info banner, invite card, members table,
// team-activity feed) — the page has no header action buttons.
export default function TeamLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header — title + description (no action buttons) */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* KPI band — agency-level team snapshot */}
      <StatStripSkeleton cells={4} />

      {/* Invitation-based onboarding info banner */}
      <div className="rounded-lg border p-3">
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      {/* Invite a team member card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-32" />
        </CardContent>
      </Card>

      {/* Members table — header bar + ~6 rows */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t">
            <div className="border-b px-4 py-3">
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="divide-y">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <div className="flex-1" />
                  <Skeleton className="hidden h-4 w-10 sm:block" />
                  <Skeleton className="hidden h-4 w-10 sm:block" />
                  <Skeleton className="hidden h-4 w-16 sm:block" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team activity feed */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <li key={i} className="flex items-start gap-3">
                <Skeleton className="mt-0.5 size-7 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-full max-w-md" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
