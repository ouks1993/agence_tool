"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SupplierOption = {
  id: string;
  name: string;
  type: string;
};

type Props = {
  suppliers: SupplierOption[];
  /** Current free-text supplier name (displayed value — parent-controlled). */
  value: string;
  /** Current linked supplier id (null if ad-hoc — parent-controlled). */
  supplierId: string | null;
  onChange: (name: string, supplierId: string | null) => void;
  placeholder?: string;
  id?: string;
};

/**
 * Combobox that lets the user pick a managed supplier or type a custom name.
 * Fully controlled — parent owns `value` and `supplierId`.
 */
export function SupplierPicker({
  suppliers,
  value,
  supplierId,
  onChange,
  placeholder = "Type or select…",
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = value.trim()
    ? suppliers.filter((s) =>
        s.name.toLowerCase().includes(value.trim().toLowerCase())
      )
    : suppliers;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value, null);
    setOpen(true);
  };

  const handleSelect = (s: SupplierOption) => {
    onChange(s.name, s.id);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <Input
          id={id}
          value={value}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
        />
        {suppliers.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 h-full shrink-0 px-2"
            onClick={() => setOpen((o) => !o)}
            tabIndex={-1}
            aria-label="Toggle supplier list"
          >
            <ChevronsUpDown className="size-3.5 opacity-50" />
          </Button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <ul className="bg-popover text-popover-foreground absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border shadow-md">
          {filtered.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(s);
                }}
              >
                <Check
                  className={cn(
                    "size-3.5 shrink-0",
                    s.id === supplierId ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="truncate font-medium">{s.name}</span>
                <span className="text-muted-foreground ml-auto shrink-0 text-xs capitalize">
                  {s.type.replace("_", " ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && value.trim() && filtered.length === 0 && (
        <div className="bg-popover text-muted-foreground absolute z-50 mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-md">
          No managed suppliers match — will be saved as ad-hoc.
        </div>
      )}
    </div>
  );
}
