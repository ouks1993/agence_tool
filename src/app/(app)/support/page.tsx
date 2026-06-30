import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import {
  Briefcase,
  Plane,
  Wallet,
  ShieldAlert,
  Map as MapIcon,
  FileText,
  Users,
  ListChecks,
  CalendarClock,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { NeedsTag } from "@/components/support/needs-tag";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import {
  BOOKING_STATUS_META,
  canViewSupport,
  roleHome,
  type BookingStatus,
} from "@/lib/domain";
import { formatDate, initials, passportExpiryStatus } from "@/lib/format";
import { paymentSummary } from "@/lib/payments/summary";
import { requireAgencyUser } from "@/lib/permissions";
import { booking, client } from "@/lib/schema";

export const metadata = { title: "Support" };

// Day windows used to slice "upcoming" bookings into the stat / strip horizons.
const MS_PER_DAY = 86_400_000;
const UPCOMING_WINDOW_DAYS = 30;
const OPS_WINDOW_DAYS = 14;

export default async function SupportPage() {
  const user = await requireAgencyUser();

  // Access gate: only support (plus admin/manager) may use this workspace.
  // Everyone else is sent to their own role home.
  if (!canViewSupport(user.role)) {
    redirect(roleHome(user.role));
  }

  const t = await getTranslations("support");

  // Single agency-scoped booking read; every queue below is derived in code.
  // Children (travellers, payments) carry no agencyId, so scoping the parent
  // booking by agencyId is what enforces tenant isolation for them too.
  const bookings = await db.query.booking.findMany({
    where: eq(booking.agencyId, user.agencyId),
    with: {
      client: { columns: { name: true } },
      travellers: true,
      payments: true,
    },
    orderBy: [desc(booking.updatedAt)],
    limit: 500,
  });

  // Agency-scoped client list with a per-client booking count (also scoped to
  // this agency's bookings so a client can never show another tenant's totals).
  const clients = await db.query.client.findMany({
    where: eq(client.agencyId, user.agencyId),
    columns: { id: true, name: true, email: true, phone: true },
    orderBy: [desc(client.updatedAt)],
    limit: 50,
  });
  const bookingCounts = await db
    .select({
      clientId: booking.clientId,
      count: sql<number>`count(*)::int`,
    })
    .from(booking)
    .where(eq(booking.agencyId, user.agencyId))
    .groupBy(booking.clientId);
  const bookingCountMap = new Map(
    bookingCounts.map((row) => [row.clientId, row.count])
  );

  const now = new Date();
  const upcomingCutoff = new Date(now.getTime() + UPCOMING_WINDOW_DAYS * MS_PER_DAY);
  const opsCutoff = new Date(now.getTime() + OPS_WINDOW_DAYS * MS_PER_DAY);

  // --- Stat derivations ----------------------------------------------------
  const active = bookings.filter((b) => b.status !== "cancelled");

  const upcoming = active.filter(
    (b) => b.departDate && new Date(b.departDate) >= now && new Date(b.departDate) <= upcomingCutoff
  );

  // A booking awaits payment when it still owes money and isn't cancelled.
  const awaitingPayment = active.filter((b) => {
    const { balance } = paymentSummary(b.payments, parseFloat(b.totalAmount || "0"));
    return balance > 0;
  });

  // Count travellers whose passport is a warning/expired risk before their trip.
  let passportAlertCount = 0;
  for (const b of active) {
    for (const t of b.travellers) {
      const status = passportExpiryStatus(t.passportExpiry, b.departDate);
      if (status.level === "warning" || status.level === "expired") {
        passportAlertCount += 1;
      }
    }
  }

  // --- Action queue --------------------------------------------------------
  // A booking enters the queue if it owes money OR has a passport risk. Each
  // row carries the "needs" reasons so support can triage at a glance.
  type QueueRow = {
    id: string;
    reference: string;
    clientName: string | null;
    destination: string | null;
    departDate: Date | null;
    status: BookingStatus;
    needsPayment: boolean;
    needsPassport: boolean;
  };
  const queue: QueueRow[] = [];
  for (const b of active) {
    const { balance } = paymentSummary(b.payments, parseFloat(b.totalAmount || "0"));
    const needsPayment = balance > 0;
    const needsPassport = b.travellers.some((t) => {
      const status = passportExpiryStatus(t.passportExpiry, b.departDate);
      return status.level === "warning" || status.level === "expired";
    });
    if (!needsPayment && !needsPassport) continue;
    queue.push({
      id: b.id,
      reference: b.reference,
      clientName: b.client?.name ?? null,
      destination: b.destination,
      departDate: b.departDate ? new Date(b.departDate) : null,
      status: b.status as BookingStatus,
      needsPayment,
      needsPassport,
    });
  }
  // Soonest departures first; undated bookings sink to the bottom.
  queue.sort((a, b) => {
    const at = a.departDate?.getTime() ?? Number.POSITIVE_INFINITY;
    const bt = b.departDate?.getTime() ?? Number.POSITIVE_INFINITY;
    return at - bt;
  });

  // --- Operations strip (next 14 days) -------------------------------------
  const opsTrips = active
    .filter(
      (b) => b.departDate && new Date(b.departDate) >= now && new Date(b.departDate) <= opsCutoff
    )
    .map((b) => {
      const lead =
        b.travellers.find((t) => t.isLead) ??
        [...b.travellers].sort((x, y) => x.sortOrder - y.sortOrder)[0] ??
        null;
      return {
        id: b.id,
        reference: b.reference,
        clientName: b.client?.name ?? null,
        destination: b.destination,
        departDate: new Date(b.departDate!),
        status: b.status as BookingStatus,
        leadTraveller: lead?.fullName ?? null,
      };
    })
    .sort((a, b) => a.departDate.getTime() - b.departDate.getTime());

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader title={t("title")} description={t("description")}>
        <Button asChild>
          <Link href="/bookings">All bookings</Link>
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active bookings"
          value={active.length}
          hint="Not cancelled"
          icon={Briefcase}
        />
        <StatCard
          label={t("upcomingTrips")}
          value={upcoming.length}
          hint={`Departing in ${UPCOMING_WINDOW_DAYS} days`}
          icon={Plane}
        />
        <StatCard
          label="Awaiting payment"
          value={awaitingPayment.length}
          hint={awaitingPayment.length ? "Balance outstanding" : "All settled"}
          icon={Wallet}
        />
        <StatCard
          label={t("passportAlerts")}
          value={passportAlertCount}
          hint={passportAlertCount ? "Need attention" : "All clear"}
          icon={ShieldAlert}
        />
      </div>

      {/* Action queue */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="size-4" /> Action queue
          </CardTitle>
          <span className="text-muted-foreground text-xs">{queue.length} to handle</span>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Nothing needs attention"
              description="Bookings awaiting payment or with passport issues will appear here."
            />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Departs</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Needs</TableHead>
                    <TableHead className="text-right">Quick links</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.map((row) => {
                    const meta = BOOKING_STATUS_META[row.status];
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          <Link href={`/bookings/${row.id}`} className="hover:underline">
                            {row.reference}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/bookings/${row.id}`}
                            className="font-medium hover:underline"
                          >
                            {row.clientName ?? "—"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.destination ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatDate(row.departDate)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            label={meta?.label ?? row.status}
                            tone={meta?.badgeClass}
                          />
                        </TableCell>
                        <TableCell>
                          <span className="flex flex-wrap gap-1">
                            {row.needsPayment && <NeedsTag kind="payment" />}
                            {row.needsPassport && <NeedsTag kind="passport" />}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center justify-end gap-1">
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/bookings/${row.id}/itinerary`} title="Itinerary">
                                <MapIcon className="size-4" />
                                <span className="sr-only">Itinerary</span>
                              </Link>
                            </Button>
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/booking-docs/${row.id}/voucher`} title="Voucher">
                                <FileText className="size-4" />
                                <span className="sr-only">Voucher</span>
                              </Link>
                            </Button>
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Clients */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" /> Clients
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/clients">All clients</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <p className="text-muted-foreground text-sm">No clients yet.</p>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link
                            href={`/clients/${c.id}`}
                            className="flex items-center gap-2 font-medium hover:underline"
                          >
                            <Avatar className="size-7">
                              <AvatarFallback className="text-xs">
                                {initials(c.name)}
                              </AvatarFallback>
                            </Avatar>
                            {c.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {c.email ?? c.phone ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {bookingCountMap.get(c.id) ?? 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Operations strip — next 14 days */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4" /> Next {OPS_WINDOW_DAYS} days
            </CardTitle>
          </CardHeader>
          <CardContent>
            {opsTrips.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No departures in the next {OPS_WINDOW_DAYS} days.
              </p>
            ) : (
              <ul className="divide-y">
                {opsTrips.slice(0, 8).map((trip) => {
                  const meta = BOOKING_STATUS_META[trip.status];
                  return (
                    <li key={trip.id} className="py-2.5">
                      <Link
                        href={`/bookings/${trip.id}`}
                        className="block space-y-0.5 hover:underline"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate font-medium">
                            {trip.clientName ?? trip.destination ?? trip.reference}
                          </span>
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {formatDate(trip.departDate)}
                          </span>
                        </span>
                        <span className="text-muted-foreground flex items-center gap-2 text-xs">
                          <StatusBadge label={meta?.label ?? trip.status} tone={meta?.badgeClass} />
                          {trip.leadTraveller ?? "No lead traveller"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
