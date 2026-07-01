import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: the proposal preview awaits the product record with its
// client and ordered items before rendering. Mirrors the live layout in page.tsx
// (muted full-height canvas, max-w-3xl, action row, document card with header,
// title, summary and item list).
export default function ProposalViewLoading() {
  return (
    <div className="bg-muted/30 min-h-screen py-8">
      <div className="mx-auto max-w-3xl px-4">
        {/* Action row — download + print */}
        <div className="mb-4 flex justify-end gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-20" />
        </div>

        {/* Document card */}
        <div className="bg-card space-y-6 rounded-lg border p-8 shadow-sm">
          {/* Header — brand + reference */}
          <div className="flex items-start justify-between border-b pb-6">
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <div className="space-y-2 text-right">
              <Skeleton className="ml-auto h-4 w-24" />
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
          </div>

          {/* Title + meta */}
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>

          {/* Item list */}
          <div className="space-y-3 border-t pt-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between border-t pt-6">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
      </div>
    </div>
  );
}
