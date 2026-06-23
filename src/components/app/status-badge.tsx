import { cn } from "@/lib/utils";

/** A small pill for stages/statuses. Pass a tailwind colour class via `tone`. */
export function StatusBadge({
  label,
  tone,
  className,
}: {
  label: string;
  tone?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        tone ?? "bg-secondary text-secondary-foreground",
        className
      )}
    >
      {label}
    </span>
  );
}
