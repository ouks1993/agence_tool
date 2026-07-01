import { statusTone, type StatusDomain, type StatusTone } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

/**
 * A small pill for stages/statuses.
 *
 * Colour it semantically: pass `variant` (one of
 * `neutral | success | warning | info | danger`). Each maps to the Wave-1
 * functional tokens (soft tint background + solid token text), so the pill stays
 * on-brand and theme-aware automatically. Use the shared `statusTone(domain,
 * status)` helper — or the `<StatusPill>` convenience wrapper — to derive it.
 *
 * Optionally render a small leading status dot with `dot`.
 */
export const STATUS_BADGE_TONES: Record<StatusTone, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  danger: "bg-danger-soft text-danger",
};

export type StatusBadgeVariant = StatusTone;

export function StatusBadge({
  label,
  variant,
  dot = false,
  dotClassName,
  className,
}: {
  label: string;
  /** Semantic tone → Wave-1 functional tokens. */
  variant?: StatusBadgeVariant;
  /** Render a small leading status dot coloured from the current text token. */
  dot?: boolean;
  /** Class overrides for the leading status dot. */
  dotClassName?: string | undefined;
  className?: string | undefined;
}) {
  const colorClass = variant
    ? STATUS_BADGE_TONES[variant]
    : STATUS_BADGE_TONES.neutral;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        colorClass,
        className
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("size-1.5 shrink-0 rounded-full bg-current", dotClassName)}
        />
      ) : null}
      {label}
    </span>
  );
}

/**
 * Convenience wrapper that derives the semantic tone from a `(domain, status)`
 * pair via `statusTone`, so callers don't repeat the mapping. Pass a `label`
 * (typically the friendly label from the domain `*_META` map); it falls back to
 * the raw status code when omitted.
 *
 * @example
 *   <StatusPill domain="booking" status={booking.status} label={meta.label} dot />
 */
export function StatusPill({
  domain,
  status,
  label,
  dot = false,
  dotClassName,
  className,
}: {
  domain: StatusDomain;
  status: string | null | undefined;
  /** Friendly label; defaults to the raw status code. */
  label?: string;
  dot?: boolean;
  dotClassName?: string;
  className?: string;
}) {
  return (
    <StatusBadge
      label={label ?? status ?? "—"}
      variant={statusTone(domain, status)}
      dot={dot}
      dotClassName={dotClassName}
      className={className}
    />
  );
}
