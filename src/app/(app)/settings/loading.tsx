import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: Settings awaits the current user + (admin-only) agency
// record before rendering. Mirrors the live layout in page.tsx (container →
// max-w-2xl, PageHeader, stacked setting cards: language, theme, profile).
export default function SettingsLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Header — title + description */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Setting cards — header (title + description) + body control */}
        {[0, 1, 2].map((i) => (
          <Card key={i}>
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
    </div>
  );
}
