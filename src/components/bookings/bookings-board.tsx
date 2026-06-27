import Link from "next/link";
import { AdvanceStatusButton } from "@/components/operations/advance-status-button";
import {
  BOOKING_LIFECYCLE,
  BOOKING_STATUS_META,
  nextBookingStatus,
  type BookingStatus,
} from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";

// Columns shown on the board (lifecycle + cancelled) — mirrors the operations page.
const COLUMNS: BookingStatus[] = [...BOOKING_LIFECYCLE, "cancelled"];

export type BookingRow = {
  id: string;
  reference: string;
  status: string;
  destination: string | null;
  departDate: string | Date | null;
  totalAmount: string;
  currency: string;
  clientName: string | null;
};

/**
 * Kanban board grouping bookings by status. Shared between the Operations
 * ("Pipeline") page and the board view of the Bookings list.
 */
export function BookingsBoard({ bookings }: { bookings: BookingRow[] }) {
  const byStatus: Record<string, BookingRow[]> = {};
  for (const s of COLUMNS) byStatus[s] = [];
  for (const b of bookings) (byStatus[b.status] ??= []).push(b);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((status) => {
        const meta = BOOKING_STATUS_META[status];
        const cards = byStatus[status] ?? [];
        const total = cards.reduce((s, c) => s + parseFloat(c.totalAmount || "0"), 0);
        return (
          <div key={status} className="w-72 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">{meta.label}</h2>
                <span className="text-muted-foreground text-xs">{cards.length}</span>
              </div>
              {total > 0 && (
                <span className="text-muted-foreground text-xs">
                  {formatMoney(total, cards[0]?.currency)}
                </span>
              )}
            </div>
            <div className="bg-muted/40 min-h-24 space-y-2 rounded-lg p-2">
              {cards.length === 0 && (
                <p className="text-muted-foreground px-2 py-6 text-center text-xs">Empty</p>
              )}
              {cards.map((b) => {
                const next = nextBookingStatus(b.status);
                return (
                  <div key={b.id} className="bg-card rounded-md border p-3 shadow-xs">
                    <Link
                      href={`/bookings/${b.id}`}
                      className="block text-sm font-medium hover:underline"
                    >
                      {b.clientName ?? b.destination ?? b.reference}
                    </Link>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {b.reference}
                      {b.destination ? ` · ${b.destination}` : ""}
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        {formatMoney(b.totalAmount, b.currency)}
                      </span>
                      {b.departDate && (
                        <span className="text-muted-foreground text-xs">
                          {formatDate(b.departDate)}
                        </span>
                      )}
                    </div>
                    {next && (
                      <div className="mt-2">
                        <AdvanceStatusButton bookingId={b.id} nextStatus={next} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
