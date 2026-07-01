import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Right-rail Margin card (deck: Margin panel — Sell / Net cost / Gross margin).
 *
 * Currency-safe: the sell price is the booking total in its own currency, and
 * gross margin is the sum of this booking's commission lines *in that same
 * currency*. Commission lines in other currencies are excluded upstream, so we
 * never mix currencies. Net cost is derived arithmetic (sell − margin) from
 * those single-currency figures — no fabricated cost column exists in the DB, so
 * the card only renders when a real, same-currency margin is known.
 */
export function BookingMarginCard({
  currency,
  sell,
  margin,
}: {
  currency: string;
  /** Booking total (sell price to the client). */
  sell: number;
  /** Sum of same-currency commission lines for this booking. */
  margin: number;
}) {
  // Nothing meaningful to show without a sell price and a real margin figure.
  if (sell <= 0 || margin <= 0) return null;

  const netCost = sell - margin;
  const marginPct = Math.round((margin / sell) * 1000) / 10;

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4" /> Margin
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="text-sm">
          <Row label="Sell" value={formatMoney(sell, currency)} />
          <Row label="Net cost" value={formatMoney(netCost, currency)} />
          <Row
            label="Gross margin"
            value={`${formatMoney(margin, currency)} · ${marginPct}%`}
            emphasis
            valueClass="text-success"
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  emphasis,
  valueClass,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
      <dt
        className={cn(
          "text-muted-foreground",
          emphasis && "text-foreground font-semibold"
        )}
      >
        {label}
      </dt>
      <dd className={cn("font-semibold tabular-nums", valueClass)}>{value}</dd>
    </div>
  );
}
