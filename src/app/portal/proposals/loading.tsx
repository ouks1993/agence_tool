import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: the portal proposals list awaits the portal session and
// the client's proposals before rendering. The portal layout already provides
// the main wrapper, so this only mirrors the inner content (heading + card grid,
// max-w-3xl to match page.tsx).
export default function PortalProposalsLoading() {
  return (
    <div className="max-w-3xl space-y-6">
      {/* Heading */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Proposal card grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="card-elevated h-full">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
