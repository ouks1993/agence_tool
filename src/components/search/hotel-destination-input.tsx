"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { searchHotelDestinationsAction } from "@/lib/actions/search";
import type { AirportSuggestion } from "@/lib/suppliers";
import { cn } from "@/lib/utils";

/**
 * Hotel destination autocomplete. Typing a city suggests verified Hotelbeds
 * destinations (name + country + code); selecting one sets BOTH the display name
 * and the destination code the search needs.
 */
export function HotelDestinationInput({
  value,
  onChange,
  onSelect,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (dest: AirportSuggestion) => void;
  placeholder?: string;
}) {
  const [results, setResults] = useState<AirportSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleType = (v: string) => {
    onChange(v);
    setActive(-1);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const r = await searchHotelDestinationsAction(v);
      setResults(r);
      setOpen(r.length > 0);
    }, 200);
  };

  const choose = (d: AirportSuggestion) => {
    onSelect(d);
    setOpen(false);
    setResults([]);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(results[active]!);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <Input
        value={value}
        onChange={(e) => handleType(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (
        <ul className="bg-popover absolute z-50 mt-1 max-h-64 w-72 overflow-auto rounded-md border p-1 shadow-md">
          {results.map((d, i) => (
            <li key={d.iata}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(d)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                  i === active ? "bg-accent" : "hover:bg-accent"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{d.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {d.country}
                  </span>
                </span>
                <span className="text-muted-foreground font-mono text-xs">{d.iata}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
