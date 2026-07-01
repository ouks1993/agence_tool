import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading shell for the AI assistant. Mirrors the real two-column workspace
 * (conversation column + context rail) so navigation doesn't cause a layout
 * shift: blurred header, day-grouped thread with alternating bubbles, a pinned
 * composer, and the 332px context rail (three stacked sections).
 */
export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] md:h-[100dvh]">
      {/* ============ CONVERSATION ============ */}
      <section className="bg-background flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="border-border bg-card/70 flex items-center gap-3 border-b px-4 py-3 backdrop-blur-sm sm:px-6">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="size-9 rounded-md" />
        </header>

        {/* Thread */}
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {/* day separator */}
            <div className="flex items-center gap-3">
              <span className="bg-border h-px flex-1" />
              <Skeleton className="h-3 w-28" />
              <span className="bg-border h-px flex-1" />
            </div>

            {/* user bubble */}
            <div className="flex flex-row-reverse gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex max-w-[86%] flex-col items-end gap-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-14 w-64 rounded-2xl rounded-br-[4px]" />
              </div>
            </div>

            {/* assistant reply with an artifact-card block */}
            <div className="flex gap-3">
              <Skeleton className="size-8 shrink-0 rounded-lg" />
              <div className="min-w-0 max-w-[86%] flex-1 space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-4 w-full max-w-md" />
                <Skeleton className="h-4 w-3/4 max-w-sm" />
                <Skeleton className="mt-2 h-40 w-full max-w-lg rounded-lg" />
              </div>
            </div>

            {/* short assistant reply */}
            <div className="flex gap-3">
              <Skeleton className="size-8 shrink-0 rounded-lg" />
              <div className="min-w-0 max-w-[86%] flex-1 space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-4 w-2/3 max-w-sm" />
              </div>
            </div>
          </div>
        </div>

        {/* Composer */}
        <div className="border-border bg-card/70 border-t px-4 py-3 backdrop-blur-sm sm:px-6">
          <div className="mx-auto max-w-3xl">
            {/* chips */}
            <div className="mb-2.5 flex flex-wrap gap-2">
              {[24, 28, 26, 30].map((w, i) => (
                <Skeleton key={i} className="h-7 rounded-full" style={{ width: `${w * 4}px` }} />
              ))}
            </div>
            {/* input */}
            <Skeleton className="h-12 w-full rounded-lg" />
            <div className="mt-2 flex items-center justify-between">
              <Skeleton className="h-3 w-64" />
              <Skeleton className="hidden h-3 w-24 sm:block" />
            </div>
          </div>
        </div>
      </section>

      {/* ============ CONTEXT RAIL ============ */}
      <aside className="bg-card border-border hidden w-[332px] shrink-0 flex-col overflow-y-auto border-l min-[1100px]:flex">
        {/* Current client */}
        <div className="border-border border-b p-5">
          <Skeleton className="mb-3 h-3 w-24" />
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
        </div>

        {/* Active booking */}
        <div className="border-border border-b p-5">
          <Skeleton className="mb-3 h-3 w-24" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>

        {/* Suggested actions */}
        <div className="border-border flex-1 border-b p-5">
          <Skeleton className="mb-3 h-3 w-28" />
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>

        {/* Footer usage note */}
        <div className="p-5">
          <Skeleton className="h-8 w-full" />
        </div>
      </aside>
    </div>
  );
}
