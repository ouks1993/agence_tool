import Link from "next/link";
import { cn } from "@/lib/utils";

export type FollowUpPriority = "high" | "medium" | "low";

export type FollowUpItem = {
  id: string;
  href: string;
  /** Main line, e.g. "Collect balance on BKG-2026-003". */
  title: string;
  /** Muted context line, e.g. "740,000 DZD due · departs 12 Jul". */
  meta: string;
  priority: FollowUpPriority;
};

const DOT_CLASS: Record<FollowUpPriority, string> = {
  high: "bg-destructive",
  medium: "bg-amber-500",
  low: "bg-muted-foreground/40",
};

/**
 * Needs-attention / follow-ups list. Items are DERIVED on the server from real
 * signals (outstanding balances, opportunities closing soon, passport alerts) —
 * there is no tasks table. Each row links to the underlying record.
 */
export function FollowUpsList({ items }: { items: FollowUpItem[] }) {
  return (
    <ul className="divide-y">
      {items.map((item) => (
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
  );
}
