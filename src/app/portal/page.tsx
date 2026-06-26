import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import {
  BOOKING_STATUS_META,
  type BookingStatus,
} from "@/lib/domain";
import { formatMoney, formatDate } from "@/lib/format";
import { requirePortalSession } from "@/lib/portal-session";
import { booking } from "@/lib/schema";

export default async function PortalPage() {
  const session = await requirePortalSession();

  // Scope strictly to this client AND their agency (defence in depth).
  const bookings = await db.query.booking.findMany({
    where: and(
      eq(booking.clientId, session.client.id),
      eq(booking.agencyId, session.client.agencyId)
    ),
    columns: {
      id: true,
      reference: true,
      status: true,
      destination: true,
      departDate: true,
      totalAmount: true,
      currency: true,
    },
    orderBy: [desc(booking.createdAt)],
  });

  if (bookings.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Trips</h1>
          <p className="text-muted-foreground">
            Welcome back, {session.client.name}
          </p>
        </div>
        <div className="py-16 text-center">
          <p className="text-muted-foreground">
            No trips found for your account yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Trips</h1>
        <p className="text-muted-foreground">
          Welcome back, {session.client.name}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bookings.map((b) => {
          const meta = BOOKING_STATUS_META[b.status as BookingStatus];
          return (
            <Link key={b.id} href={`/portal/bookings/${b.id}`}>
              <Card className="card-interactive cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {b.destination ?? "Trip"}
                    </CardTitle>
                    {meta ? (
                      <Badge variant="secondary" className={meta.badgeClass}>
                        {meta.label}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{b.status}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {b.reference}
                    {b.departDate ? ` · ${formatDate(b.departDate)}` : ""}
                  </p>
                  <p className="text-sm font-semibold mt-1">
                    {formatMoney(b.totalAmount, b.currency)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
