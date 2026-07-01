import { formatMoney } from "@/lib/format";

/**
 * Renders the non-base-currency slices of a `sumByCurrency` map as small chips.
 *
 * The money screens headline a single base-currency (DZD) total — never a blended
 * cross-currency sum. When bookings/commissions in other currencies exist, we
 * surface each one explicitly here so no figure is silently dropped *or* silently
 * added into the DZD headline. Each chip is formatted in its own currency.
 *
 * Renders nothing when there are no other currencies (the common single-currency
 * case), so callers can drop it in unconditionally.
 */
export function CurrencyNote({
  others,
  className,
  prefix = "also",
}: {
  others: { currency: string; value: number }[];
  className?: string;
  /** Leading word before the chips, e.g. "also" / "outstanding". */
  prefix?: string;
}) {
  if (others.length === 0) return null;
  return (
    <p className={className ?? "text-muted-foreground mt-1 text-xs"}>
      <span className="mr-1">{prefix}</span>
      {others.map((o, i) => (
        <span key={o.currency}>
          {i > 0 && <span className="mx-0.5">·</span>}
          <span className="tabular-nums font-medium">
            {formatMoney(o.value, o.currency)}
          </span>
        </span>
      ))}
    </p>
  );
}
