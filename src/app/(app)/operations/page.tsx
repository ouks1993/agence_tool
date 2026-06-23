import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { AdvanceStatusButton } from "@/components/operations/advance-status-button";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import {
  BOOKING_LIFECYCLE,
  BOOKING_STATUS_META,
  nextBookingStatus,
  type BookingStatus,
} from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { requireUser } from "@/lib/permissions";
import { booking } from "@/lib/schema";

export const metadata = { title: "Operations" };

// Columns shown on the operations board (lifecycle + cancelled).
const COLUMNS: BookingStatus[] = [...BOOKING_LIFECYCLE, "cancelled"];

export default async function OperationsPage() {
  const user = await requireUser();
  const isManager = user.role === "manager";

  const bookings = await db.query.booking.findMany({
    where: isManager ? undefined : eq(booking.createdById, user.id),
    with: { client: { columns: { name: true } } },
    orderBy: [desc(booking.updatedAt)],
    limit: 500,
  });

  const byStatus: Record<string, typeof bookings> = {};
  for (const s of COLUMNS) byStatus[s] = [];
  for (const b of bookings) (byStatus[b.status] ??= []).push(b);

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Operations"
        description="Track every booking through confirmation, ticketing and completion."
      />

      {bookings.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nothing in operations yet"
          description="Bookings appear here as they move through the workflow."
          action={
            <Button asChild>
              <Link href="/bookings/new">New booking</Link>
            </Button>
          }
        />
      ) : (
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
                          {b.client?.name ?? b.destination ?? b.reference}
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
      )}
    </div>
  );
}
