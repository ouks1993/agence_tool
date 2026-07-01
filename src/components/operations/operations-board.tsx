"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { BookingsBoard, type BookingRow } from "@/components/bookings/bookings-board";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BOOKING_LIFECYCLE, BOOKING_STATUS_META, type BookingStatus } from "@/lib/domain";

/**
 * Client controls layer for the Operations board: a free-text search plus a
 * status-scope segmented control (All + one tab per lifecycle stage). Filters
 * the server-provided rows in memory and hands the result to {@link BookingsBoard}.
 *
 * All money/KPI aggregation stays on the server (currency-safe); this component
 * only slices the already-loaded rows by client-side controls.
 */
const SCOPES: ("all" | BookingStatus)[] = ["all", ...BOOKING_LIFECYCLE, "cancelled"];

export function OperationsBoard({ bookings }: { bookings: BookingRow[] }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | BookingStatus>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings.filter((b) => {
      if (scope !== "all" && b.status !== scope) return false;
      if (!q) return true;
      return (
        b.reference.toLowerCase().includes(q) ||
        (b.clientName?.toLowerCase().includes(q) ?? false) ||
        (b.destination?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [bookings, query, scope]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reference, client or destination…"
            aria-label="Search bookings"
            className="pl-9"
          />
        </div>
        <Tabs
          value={scope}
          onValueChange={(v) => setScope(v as "all" | BookingStatus)}
          className="w-full sm:w-auto"
        >
          <TabsList className="flex-wrap">
            {SCOPES.map((s) => (
              <TabsTrigger key={s} value={s} className="tabular-nums">
                {s === "all" ? "All" : BOOKING_STATUS_META[s].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <BookingsBoard bookings={filtered} />
    </div>
  );
}
