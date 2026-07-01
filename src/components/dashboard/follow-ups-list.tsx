import Link from "next/link";
import { cn } from "@/lib/utils";

export type FollowUpPriority = "high" | "medium" | "low";

/** The signal a follow-up is derived from — drives grouping + section headers. */
export type FollowUpKind = "payment" | "deal" | "document";

export type FollowUpItem = {
  id: string;
  /** Which derived signal produced this row (balances, deals, passports). */
  kind: FollowUpKind;
  href: string;
  /** Main line, e.g. "Collect balance on BKG-2026-003". */
  title: string;
  /** Muted context line, e.g. "740,000 DZD due · departs 12 Jul". */
  meta: string;
  priority: FollowUpPriority;
};

// Dot tone by urgency (functional status tokens): overdue/expired → danger,
// due-soon → warning, low → muted. This replaces the uniform red so the wall of
// items reads by severity at a glance.
const DOT_CLASS: Record<FollowUpPriority, string> = {
  high: "bg-danger",
  medium: "bg-warning",
  low: "bg-muted-foreground/40",
};

// Section metadata, in display order. Payments first (money at risk), then
// deals, then documents.
const GROUP_ORDER: readonly FollowUpKind[] = ["payment", "deal", "document"];
const GROUP_LABEL: Record<FollowUpKind, string> = {
  payment: "Payments",
  deal: "Deals",
  document: "Documents",
};

// Show at most this many rows per group; the rest are summarised in a footer
// count so a single busy group can't drown the others.
const PER_GROUP_CAP = 4;

const PRIORITY_RANK: Record<FollowUpPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Needs-attention / follow-ups list, grouped by kind. Items are DERIVED on the
 * server from real signals (outstanding balances, opportunities closing soon,
 * passport alerts) — there is no tasks table. Each row links to the underlying
 * record. Server-rendered; no client state.
 */
export function FollowUpsList({ items }: { items: FollowUpItem[] }) {
  // Bucket by kind, most-urgent first within each bucket.
  const groups = GROUP_ORDER.map((kind) => {
    const rows = items
      .filter((i) => i.kind === kind)
      .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    return { kind, rows };
  }).filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-4">
      {groups.map(({ kind, rows }) => {
        const shown = rows.slice(0, PER_GROUP_CAP);
        const hidden = rows.length - shown.length;
        return (
          <div key={kind}>
            <div className="mb-1 flex items-baseline justify-between">
              <h4 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                {GROUP_LABEL[kind]}
              </h4>
              <span className="text-muted-foreground text-xs tabular-nums">
                {rows.length}
              </span>
            </div>
            <ul className="divide-y">
              {shown.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="hover:bg-accent/50 -mx-2 flex items-start gap-2.5 rounded-md px-2 py-2.5 transition-colors"
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        DOT_CLASS[item.priority]
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-snug font-medium">
                        {item.title}
                      </span>
                      <span className="text-muted-foreground mt-0.5 block text-xs">
                        {item.meta}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {hidden > 0 && (
              <p className="text-muted-foreground mt-1 text-xs">
                +{hidden} more
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
