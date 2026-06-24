import Link from "next/link";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { Plus, Briefcase, Users } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { BOOKING_STATUS_META, type BookingStatus } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { requireAgencyUser } from "@/lib/permissions";
import { booking, bookingTraveller } from "@/lib/schema";

export const metadata = { title: "Bookings" };

export default async function BookingsPage() {
  const user = await requireAgencyUser();

  const bookings = await db.query.booking.findMany({
    where: eq(booking.agencyId, user.agencyId),
    with: { client: { columns: { name: true } } },
    orderBy: [desc(booking.createdAt)],
    limit: 200,
  });

  // Traveller counts are scoped to this agency's bookings only (children have no agencyId).
  const bookingIds = bookings.map((b) => b.id);
  const counts =
    bookingIds.length > 0
      ? await db
          .select({
            bookingId: bookingTraveller.bookingId,
            count: sql<number>`count(*)::int`,
          })
          .from(bookingTraveller)
          .where(inArray(bookingTraveller.bookingId, bookingIds))
          .groupBy(bookingTraveller.bookingId)
      : [];
  const countMap = new Map(counts.map((c) => [c.bookingId, c.count]));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Bookings"
        description="Each booking file: travellers, flights & hotels, and extras."
      >
        <Button asChild>
          <Link href="/bookings/new">
            <Plus className="mr-2 size-4" />
            New booking
          </Link>
        </Button>
      </PageHeader>

      {bookings.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No bookings yet"
          description="Create a booking, add the travellers' passport details, then add their flights, hotels and extras."
          action={
            <Button asChild>
              <Link href="/bookings/new">
                <Plus className="mr-2 size-4" />
                New booking
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Travel dates</TableHead>
                <TableHead className="text-right">Pax</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => {
                const meta = BOOKING_STATUS_META[b.status as BookingStatus];
                return (
                  <TableRow key={b.id}>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      <Link href={`/bookings/${b.id}`} className="hover:underline">
                        {b.reference}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/bookings/${b.id}`} className="font-medium hover:underline">
                        {b.client?.name ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {b.destination ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {b.departDate || b.returnDate
                        ? `${formatDate(b.departDate)} → ${formatDate(b.returnDate)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-muted-foreground inline-flex items-center gap-1">
                        <Users className="size-3" />
                        {countMap.get(b.id) ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge label={meta?.label ?? b.status} tone={meta?.badgeClass} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(b.totalAmount, b.currency)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
