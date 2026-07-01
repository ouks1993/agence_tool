import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: Settings awaits the current user + (admin-only) agency
// record before rendering. Mirrors the live layout in page.tsx (container →
// max-w-2xl, PageHeader, sectioned card groups: Preferences → Account).
export default function SettingsLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-10">
        {/* Header — title + description */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Section groups — a small label then one or more setting cards */}
        {[2, 1].map((cardCount, section) => (
          <div key={section} className="space-y-4">
            <Skeleton className="h-3 w-24" />
            {Array.from({ length: cardCount }).map((_, i) => (
              <Card key={i} className="card-elevated">
                <CardHeader className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-56" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-9 w-full max-w-xs" />
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
