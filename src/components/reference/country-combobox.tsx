"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { COUNTRIES, NATIONALITIES } from "@/lib/reference/countries";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string; flag: string; haystack: string };

const COUNTRY_OPTIONS: Option[] = COUNTRIES.map((c) => ({
  value: c.name,
  label: c.name,
  flag: c.flag,
  haystack: `${c.name} ${c.code}`.toLowerCase(),
}));

const NATIONALITY_OPTIONS: Option[] = NATIONALITIES.map((n) => ({
  value: n.nationality,
  label: n.nationality,
  flag: n.flag,
  haystack: n.nationality.toLowerCase(),
}));

/**
 * Searchable country / nationality picker. Options are sourced from the ISO
 * reference list so the stored value is always one of the canonical names —
 * preventing duplicate spellings — while the field still reads as plain text.
 */
export function CountryCombobox({
  value,
  onChange,
  mode = "country",
  id,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  mode?: "country" | "nationality";
  id?: string;
  placeholder?: string;
}) {
  const options = mode === "nationality" ? NATIONALITY_OPTIONS : COUNTRY_OPTIONS;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // When closed, show the selected value with its flag; while typing, show the query.
  const selected = options.find((o) => o.value === value);
  const display = open ? query : value;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 60);
    return options.filter((o) => o.haystack.includes(q)).slice(0, 60);
  }, [query, options]);

  const choose = (o: Option) => {
    onChange(o.value);
    setOpen(false);
    setQuery("");
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % Math.max(results.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0 && results[active]) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <Input
        id={id}
        value={open ? display : selected ? `${selected.flag} ${selected.label}` : display}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(-1);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? (mode === "nationality" ? "Select nationality…" : "Select country…")}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul className="bg-popover absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border p-1 shadow-md">
          {results.map((o, i) => (
            <li key={o.value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                  i === active ? "bg-accent" : "hover:bg-accent",
                  o.value === value && "font-medium"
                )}
              >
                <span>{o.flag}</span>
                <span className="truncate">{o.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
