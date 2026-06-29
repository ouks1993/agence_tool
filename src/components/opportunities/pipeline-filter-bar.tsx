"use client";

import { Users, MapPin } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type DealScope = "all" | "mine" | "closing";

export type OwnerOption = { id: string; name: string };

/**
 * Client-side filter bar for the pipeline board. Operates purely on the
 * already-loaded items via the callbacks below — it never touches the server
 * query or RBAC scope.
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
}: {
  scope: DealScope;
  onScopeChange: (scope: DealScope) => void;
  owners: OwnerOption[];
  ownerId: string;
  onOwnerChange: (id: string) => void;
  destinations: string[];
  destination: string;
  onDestinationChange: (d: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs value={scope} onValueChange={(v) => onScopeChange(v as DealScope)}>
        <TabsList>
          <TabsTrigger value="all">All deals</TabsTrigger>
          <TabsTrigger value="mine">My deals</TabsTrigger>
          <TabsTrigger value="closing">Closing soon</TabsTrigger>
        </TabsList>
      </Tabs>

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
    </div>
  );
}
