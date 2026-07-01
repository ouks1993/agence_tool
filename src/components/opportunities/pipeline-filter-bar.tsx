"use client";

import { Users, MapPin, LayoutGrid, List } from "lucide-react";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type DealScope = "all" | "mine" | "closing" | "lost";
export type BoardView = "board" | "list";

export type OwnerOption = { id: string; name: string };

const SCOPES: { value: DealScope; label: string }[] = [
  { value: "all", label: "All deals" },
  { value: "mine", label: "My deals" },
  { value: "closing", label: "Closing soon" },
  { value: "lost", label: "Lost" },
];

/**
 * Client-side filter bar for the pipeline board. Operates purely on the
 * already-loaded items via the callbacks below — it never touches the server
 * query or RBAC scope. The scope control uses the deck's dark-ink segmented
 * control (active pill = ink surface, white text).
 */
export function PipelineFilterBar({
  scope,
  onScopeChange,
  owners,
  ownerId,
  onOwnerChange,
  destinations,
  destination,
  onDestinationChange,
  view,
  onViewChange,
}: {
  scope: DealScope;
  onScopeChange: (scope: DealScope) => void;
  owners: OwnerOption[];
  ownerId: string;
  onOwnerChange: (id: string) => void;
  destinations: string[];
  destination: string;
  onDestinationChange: (d: string) => void;
  view: BoardView;
  onViewChange: (v: BoardView) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Dark-ink segmented scope control (deck identity). */}
      <div className="bg-secondary inline-flex gap-0.5 rounded-md p-0.5">
        {SCOPES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onScopeChange(s.value)}
            aria-pressed={scope === s.value}
            className={cn(
              "rounded-sm px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
              scope === s.value
                ? "bg-sidebar text-sidebar-accent-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Users className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Select
          aria-label="Filter by owner"
          value={ownerId}
          onChange={(e) => onOwnerChange(e.target.value)}
          className="h-9 w-auto min-w-[10rem] pl-8"
        >
          <option value="all">Owner: All</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="relative">
        <MapPin className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Select
          aria-label="Filter by destination"
          value={destination}
          onChange={(e) => onDestinationChange(e.target.value)}
          className="h-9 w-auto min-w-[10rem] pl-8"
        >
          <option value="all">Destination: All</option>
          {destinations.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      </div>

      {/* Right-aligned board/list view toggle. */}
      <div className="bg-secondary ml-auto inline-flex gap-0.5 rounded-md p-0.5">
        <button
          type="button"
          onClick={() => onViewChange("board")}
          aria-label="Board view"
          aria-pressed={view === "board"}
          className={cn(
            "rounded-sm p-1.5 transition-colors",
            view === "board"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <LayoutGrid className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onViewChange("list")}
          aria-label="List view"
          aria-pressed={view === "list"}
          className={cn(
            "rounded-sm p-1.5 transition-colors",
            view === "list"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <List className="size-4" />
        </button>
      </div>
    </div>
  );
}
