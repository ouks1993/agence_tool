import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton: the Operations page awaits an agency-wide bookings
// query (up to 500 rows) before rendering the pipeline board. We show the page
// shell — header + a horizontal row of kanban columns — while that loads.
// Mirrors the live layout: max-w-[100rem] container, PageHeader, and the
// BookingsBoard's w-72 columns with bg-muted/40 bodies holding card placeholders.
export default function OperationsLoading() {
  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6 px-4 py-8 sm:px-6">
      {/* Header — title + description (no actions on this page) */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Pipeline board — horizontal row of status columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[0, 1, 2, 3, 4].map((col) => (
          <div key={col} className="w-72 shrink-0">
            {/* Column header — label + count */}
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-6" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>

            {/* Column body — card placeholders */}
            <div className="bg-muted/40 min-h-24 space-y-2 rounded-lg p-2">
              {[0, 1, 2].map((card) => (
                <div
                  key={card}
                  className="bg-card space-y-2 rounded-md border p-3 shadow-xs"
                >
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-28" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
