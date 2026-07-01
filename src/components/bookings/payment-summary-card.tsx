import { Wallet } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Compact right-rail payment summary (deck: Payment summary panel).
 *
 * Presentation-only: every figure is derived from the already-computed
 * total / paid / balance values that the page passes down (single-currency,
 * DZD-safe — never sums across currencies). The "Record payment" action is a
 * same-page anchor to the existing PaymentsManager section (`#payments`) so the
 * real record-payment server action remains the single source of truth. No
 * send-reminder button is rendered because no reminder action exists in the app.
 */
export function PaymentSummaryCard({
  currency,
  total,
  paid,
  balance,
  paidPct,
  balanceDueDate,
}: {
  currency: string;
  total: number;
  paid: number;
  balance: number;
  paidPct: number;
  /** Departure date used as the operative "balance due before" date, if known. */
  balanceDueDate: Date | string | null;
}) {
  const settled = balance <= 0 && total > 0;
  const tone = settled
    ? "bg-green-500/15 text-green-600 dark:text-green-400"
    : paid > 0
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      : "bg-slate-500/15 text-slate-600 dark:text-slate-300";
  const statusLabel = settled ? "Paid in full" : paid > 0 ? "Part-paid" : "Unpaid";

  return (
    <Card className="card-elevated">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="size-4" /> Payment summary
        </CardTitle>
        <StatusBadge label={statusLabel} tone={tone} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>{paidPct}% collected</span>
            <span className="tabular-nums">
              {formatMoney(paid, currency)} / {formatMoney(total, currency)}
            </span>
          </div>
          <div
            className="bg-muted h-2 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={paidPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Payment collected"
          >
            <div
              style={{ width: `${paidPct}%` }}
              className={cn(
                "h-2 rounded-full",
                settled ? "bg-green-500" : "bg-primary"
              )}
            />
          </div>
        </div>

        <Separator />

        <dl className="space-y-1 text-sm">
          <Row label="Total" value={formatMoney(total, currency)} emphasis />
          <Row
            label="Paid"
            value={formatMoney(paid, currency)}
            valueClass="text-green-600 dark:text-green-400"
          />
          <Row
            label="Outstanding"
            value={formatMoney(balance, currency)}
            valueClass={
              balance > 0 ? "text-amber-600 dark:text-amber-400" : undefined
            }
          />
          {balanceDueDate && balance > 0 && (
            <Row label="Balance due" value={formatDate(balanceDueDate)} />
          )}
        </dl>

        <Button asChild className="w-full">
          <a href="#payments">
            <Wallet className="mr-2 size-4" />
            Record payment
          </a>
        </Button>
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
  valueClass?: string | undefined;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <dt
        className={cn(
          "text-muted-foreground",
          emphasis && "text-foreground font-semibold"
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums font-semibold",
          emphasis && "text-base",
          valueClass
        )}
      >
        {value}
      </dd>
    </div>
  );
}
