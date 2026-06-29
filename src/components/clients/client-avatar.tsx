import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Deterministic, soft-tinted avatar derived from a name. Server-safe (no Radix):
 * renders initials over a colour picked from a fixed palette via a stable hash,
 * so the same client always gets the same chip colour.
 */
const PALETTE = [
  "bg-chart-1/15 text-chart-1",
  "bg-chart-2/15 text-chart-2",
  "bg-chart-3/15 text-chart-3",
  "bg-chart-4/15 text-chart-4",
  "bg-chart-5/15 text-chart-5",
  "bg-chart-6/15 text-chart-6",
] as const;

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function clientAvatarTone(name: string): string {
  return PALETTE[hash(name) % PALETTE.length] ?? PALETTE[0];
}

export function ClientAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        clientAvatarTone(name),
        className
      )}
    >
      {initials(name)}
    </span>
  );
}
