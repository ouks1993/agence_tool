import { CreditCard, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/** The kinds of attention a booking can need in the support queue. */
export type NeedKind = "payment" | "passport";

const NEED_META: Record<
  NeedKind,
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  payment: {
    label: "Awaiting payment",
    icon: CreditCard,
    tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  passport: {
    label: "Passport issue",
    icon: ShieldAlert,
    tone: "bg-red-500/15 text-red-600 dark:text-red-400",
  },
};

/**
 * A small pill describing why a booking is in the action queue. Mirrors the
 * StatusBadge pill shape but carries an icon so support can scan the queue fast.
 */
export function NeedsTag({ kind, className }: { kind: NeedKind; className?: string }) {
  const meta = NEED_META[kind];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        meta.tone,
        className
      )}
    >
      <Icon className="size-3" />
      {meta.label}
    </span>
  );
}
