"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Flat occupancy for the whole party — matches the search-bar fields. */
export type Occupancy = {
  rooms: number;
  adults: number;
  /** One entry per child; the value is the child's age in years (0–17). */
  childAges: number[];
};

export const DEFAULT_OCCUPANCY: Occupancy = { rooms: 1, adults: 2, childAges: [] };

export function occupancySummary(o: Occupancy): string {
  const parts = [
    `${o.rooms} room${o.rooms === 1 ? "" : "s"}`,
    `${o.adults} adult${o.adults === 1 ? "" : "s"}`,
  ];
  if (o.childAges.length) {
    parts.push(`${o.childAges.length} child${o.childAges.length === 1 ? "" : "ren"}`);
  }
  return parts.join(" · ");
}

/**
 * Booking.com-style occupancy control. Rooms / adults / children steppers plus
 * a child-age <select> that appears the instant children > 0. Every change
 * propagates immediately via onChange so prices can re-fetch live.
 */
export function OccupancyPicker({
  value,
  onChange,
  className,
}: {
  value: Occupancy;
  onChange: (next: Occupancy) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const setChildCount = (count: number) => {
    const childAges = Array.from({ length: count }, (_, i) => value.childAges[i] ?? 8);
    onChange({ ...value, childAges });
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="border-input bg-transparent ring-offset-background focus-visible:ring-ring flex h-9 w-full items-center gap-2 rounded-md border px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none"
      >
        <Users className="text-muted-foreground size-4 shrink-0" />
        <span className="truncate">{occupancySummary(value)}</span>
      </button>

      {open && (
        <div className="bg-popover text-popover-foreground animate-scale-in absolute z-50 mt-1 w-72 space-y-3 rounded-md border p-3 shadow-md">
          <Stepper
            label="Rooms"
            value={value.rooms}
            min={1}
            max={8}
            onChange={(rooms) => onChange({ ...value, rooms })}
          />
          <Stepper
            label="Adults"
            value={value.adults}
            min={1}
            max={9}
            onChange={(adults) => onChange({ ...value, adults })}
          />
          <Stepper
            label="Children"
            hint="0–17 yrs"
            value={value.childAges.length}
            min={0}
            max={6}
            onChange={setChildCount}
          />

          {value.childAges.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs">Age of each child at check-out</Label>
              <div className="grid grid-cols-3 gap-2">
                {value.childAges.map((age, i) => (
                  <Select
                    key={i}
                    aria-label={`Child ${i + 1} age`}
                    value={String(age)}
                    onChange={(e) => {
                      const childAges = value.childAges.slice();
                      childAges[i] = Number(e.target.value);
                      onChange({ ...value, childAges });
                    }}
                    className="h-8 text-xs"
                  >
                    {Array.from({ length: 18 }, (_, a) => (
                      <option key={a} value={a}>
                        {a === 0 ? "<1 yr" : `${a} yr${a === 1 ? "" : "s"}`}
                      </option>
                    ))}
                  </Select>
                ))}
              </div>
            </div>
          )}

          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={() => setOpen(false)}
          >
            Done
          </Button>
        </div>
      )}
    </div>
  );
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="leading-tight">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-7"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`Decrease ${label}`}
        >
          <Minus className="size-3.5" />
        </Button>
        <span className="w-5 text-center text-sm tabular-nums">{value}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-7"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={`Increase ${label}`}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
