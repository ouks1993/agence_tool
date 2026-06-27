/**
 * Minimal RFC-4180 CSV writer. Prepends a UTF-8 BOM so Excel opens accented
 * text (é, ç, ü) correctly, and quotes any field containing a comma, quote or
 * newline.
 */
export type Cell = string | number | null | undefined;

function escape(value: Cell): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: string[], rows: Cell[][]): string {
  const lines = [
    columns.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ];
  return "﻿" + lines.join("\r\n");
}
