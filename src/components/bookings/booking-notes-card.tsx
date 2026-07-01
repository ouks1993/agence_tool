import { AlertTriangle, StickyNote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatMoney } from "@/lib/format";

/**
 * Right-rail Notes panel (deck: Notes) with an amber balance-due banner.
 *
 * The note body is booking.notes (real column). The banner is shown only when a
 * real balance is due before a known departure date — derived from the same
 * balance / departDate the page already computes. Renders nothing when there is
 * neither a note nor a balance warning to show.
 */
export function BookingNotesCard({
  notes,
  currency,
  balance,
  departDate,
}: {
  notes: string | null;
  currency: string;
  balance: number;
  departDate: Date | string | null;
}) {
  const showWarning = balance > 0 && Boolean(departDate);
  if (!notes && !showWarning) return null;

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <StickyNote className="size-4" /> Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {showWarning && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              Collect {formatMoney(balance, currency)} balance before{" "}
              {formatDate(departDate)} to release tickets.
            </p>
          </div>
        )}
        {notes && (
          <p className="text-sm whitespace-pre-wrap">{notes}</p>
        )}
      </CardContent>
    </Card>
  );
}
