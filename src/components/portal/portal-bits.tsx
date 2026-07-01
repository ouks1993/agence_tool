import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared presentational building blocks for the traveller portal. Purely
 * visual — no data fetching, no client interactivity. Rebuilt to match the
 * marketing-deck customer-portal mockup while using semantic design tokens.
 */

/** A gradient thumbnail avatar used for trip rows. Cycles through brand tints. */
const TRIP_GRADIENTS = [
  "from-primary to-primary/60",
  "from-cyan-500 to-emerald-500",
  "from-amber-600 to-orange-500",
  "from-violet-500 to-primary",
] as const;

export function tripGradient(index: number): string {
  return TRIP_GRADIENTS[index % TRIP_GRADIENTS.length] ?? TRIP_GRADIENTS[0];
}

/** Section header with a title and an optional right-side hint/action. */
export function SectionHead({
  title,
  hint,
  action,
  id,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div id={id} className="mb-3.5 flex items-center justify-between gap-3">
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      {action ??
        (hint ? (
          <span className="text-muted-foreground text-sm">{hint}</span>
        ) : null)}
    </div>
  );
}

/** A single key/value info line for the "Trip at a glance" side card. */
export function InfoLine({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t py-2.5 text-sm first:border-t-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right font-medium">{children}</span>
    </div>
  );
}

/**
 * Branded tint panel — the deck's soft brand-gradient surface, defined once so
 * the gradient is not duplicated inline across portal pages. Renders a bordered
 * card with a `--accent → --card` wash and a subtle brand border.
 */
export function TintPanel({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn("border-primary/20 rounded-lg border p-5", className)}
      style={{
        backgroundImage:
          "linear-gradient(180deg, var(--accent) 0%, var(--card) 100%)",
      }}
    >
      {children}
    </div>
  );
}

/** A dot + label status pill tinted with an arbitrary tone class. */
export function TripStatusPill({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        className ?? "bg-secondary text-secondary-foreground"
      )}
    >
      {label}
    </span>
  );
}
