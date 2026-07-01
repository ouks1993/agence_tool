import { Boxes } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type SupplierRefRow = {
  id: string;
  providerId: string;
  confirmationNumber: string;
  pnr: string | null;
  supplierOrderId: string | null;
};

/**
 * Right-rail supplier references (deck: Supplier references panel).
 *
 * Every value comes from booking_supplier_ref real columns (providerId,
 * confirmationNumber, pnr, supplierOrderId). Renders nothing when there are no
 * refs, so bookings without supplier confirmations simply omit the card.
 * No commission line is rendered — commission is not stored on this table.
 */
export function SupplierRefsCard({ refs }: { refs: SupplierRefRow[] }) {
  if (refs.length === 0) return null;

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Boxes className="size-4" /> Supplier references
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        <ul className="divide-y">
          {refs.map((r) => (
            <li key={r.id} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground capitalize">
                  {r.providerId}
                </span>
                <span className="font-mono text-xs font-medium">
                  {r.confirmationNumber}
                </span>
              </div>
              {r.pnr && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground text-xs">PNR</span>
                  <span className="font-mono text-xs">{r.pnr}</span>
                </div>
              )}
              {r.supplierOrderId && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground text-xs">Order</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {r.supplierOrderId}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
