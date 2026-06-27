"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";

/**
 * City field with autocomplete suggestions but free entry still allowed.
 * Backed by a curated list of major Algerian + international cities via a native
 * <datalist> — improves consistency without a heavyweight city reference table.
 */
const CITY_SUGGESTIONS = [
  // Algeria
  "Algiers", "Oran", "Constantine", "Annaba", "Blida", "Sétif", "Batna",
  "Tlemcen", "Béjaïa", "Tizi Ouzou", "Djelfa", "Sidi Bel Abbès", "Biskra",
  "Tébessa", "Ouargla", "Béchar", "Mostaganem", "Bordj Bou Arréridj",
  "Skikda", "Ghardaïa", "Tamanrasset", "Adrar",
  // International (common agency markets)
  "Paris", "Lyon", "Marseille", "London", "Madrid", "Barcelona", "Rome",
  "Milan", "Istanbul", "Antalya", "Dubai", "Abu Dhabi", "Doha", "Riyadh",
  "Jeddah", "Mecca", "Medina", "Cairo", "Tunis", "Casablanca", "Marrakech",
  "Montreal", "Toronto", "Brussels", "Amsterdam", "Frankfurt", "Geneva",
  "Kuala Lumpur", "Bangkok", "Bali", "Singapore", "New York",
];

export function CityInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const listId = useId();
  return (
    <>
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Start typing a city…"}
        autoComplete="off"
      />
      <datalist id={listId}>
        {CITY_SUGGESTIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
}
