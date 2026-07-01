import Link from "next/link";
import { StatusBadge } from "@/components/app/status-badge";
import { type StatusTone } from "@/lib/status-tone";

export type DepartureRow = {
  id: string;
  /** Day-of-month, e.g. "05". */
  day: string;
  /** Short month, e.g. "Jul". */
  month: string;
  /** Headline line — client name (falls back to destination / reference). */
  title: string;
  /** Subline, e.g. "Dubai · BKG-2026-001". */
  subline: string;
  statusLabel: string;
  statusTone?: StatusTone;
};

/**
 * Upcoming-departures list with the mockup's two-line day/month date chip,
 * a client headline, a "destination · reference" subline, and a status badge.
 */
export function DeparturesList({ rows }: { rows: DepartureRow[] }) {
  return (
    <ul className="divide-y">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/bookings/${r.id}`}
            className="hover:bg-accent/50 -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors"
          >
            <span className="bg-secondary/60 flex w-11 shrink-0 flex-col items-center rounded-md border py-1.5 leading-none">
              <span className="text-base font-bold tracking-tight tabular-nums">
                {r.day}
              </span>
              <span className="text-muted-foreground mt-0.5 text-[10px] font-semibold uppercase tracking-wide">
                {r.month}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{r.title}</span>
              <span className="text-muted-foreground block truncate text-xs">
                {r.subline}
              </span>
            </span>
            <StatusBadge
              label={r.statusLabel}
              {...(r.statusTone ? { variant: r.statusTone } : {})}
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
