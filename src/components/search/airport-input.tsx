"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { searchAirportsAction } from "@/lib/actions/search";
import type { AirportSuggestion } from "@/lib/suppliers";
import { cn } from "@/lib/utils";

/**
 * Airport/city autocomplete input. As the user types (debounced) it queries the
 * provider's places API and shows name / city / country suggestions; picking one
 * sets the field to the IATA code. Typing a 3-letter code directly still works.
 */
export function AirportInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
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
    if (v.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const r = await searchAirportsAction(v);
      setResults(r);
      setOpen(r.length > 0);
    }, 250);
  };

  const select = (a: AirportSuggestion) => {
    onChange(a.iata);
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
      select(results[active]!);
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
          {results.map((a, i) => (
            <li key={`${a.iata}-${a.name}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(a)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                  i === active ? "bg-accent" : "hover:bg-accent"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{a.name}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {a.city}
                    {a.country ? `, ${a.country}` : ""}
                  </span>
                </span>
                <span className="text-muted-foreground font-mono text-xs">{a.iata}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
