import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Briefcase, Wallet, Plane, ShieldAlert, Plus, Activity } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describeActivity } from "@/lib/activity-format";
import { db } from "@/lib/db";
import { BOOKING_STATUS_META, type BookingStatus } from "@/lib/domain";
import {
  formatMoney,
  formatRelative,
  formatDate,
  initials,
  passportExpiryStatus,
} from "@/lib/format";
import { requireUser } from "@/lib/permissions";
import { booking, activityLog } from "@/lib/schema";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const isManager = user.role === "manager";

  // Bookings (scoped: managers see all, agents see what they created).
  const bookings = await db.query.booking.findMany({
    where: isManager ? undefined : eq(booking.createdById, user.id),
    with: {
      client: { columns: { id: true, name: true } },
      travellers: true,
    },
    orderBy: [desc(booking.createdAt)],
    limit: 500,
  });

  const active = bookings.filter((b) => b.status !== "cancelled");
  const activeValue = active.reduce((s, b) => s + parseFloat(b.totalAmount || "0"), 0);
  const confirmedRevenue = bookings
    .filter((b) => b.status === "confirmed" || b.status === "paid")
    .reduce((s, b) => s + parseFloat(b.totalAmount || "0"), 0);

  const now = new Date();
  const upcoming = bookings
    .filter((b) => b.departDate && new Date(b.departDate) >= now && b.status !== "cancelled")
    .sort(
      (a, b) => new Date(a.departDate!).getTime() - new Date(b.departDate!).getTime()
    );

  // Passport alerts across non-cancelled bookings.
  const passportAlerts: {
    bookingId: string;
    reference: string;
    traveller: string;
    message: string;
    level: "warning" | "expired";
  }[] = [];
  for (const b of active) {
    for (const t of b.travellers) {
      const status = passportExpiryStatus(t.passportExpiry, b.departDate);
      if (status.level === "warning" || status.level === "expired") {
        passportAlerts.push({
          bookingId: b.id,
          reference: b.reference,
          traveller: t.fullName,
          message: status.message,
          level: status.level,
        });
      }
    }
  }

  const activities = await db.query.activityLog.findMany({
    where: isManager ? undefined : eq(activityLog.userId, user.id),
    with: { user: { columns: { name: true } } },
    orderBy: [desc(activityLog.createdAt)],
    limit: 10,
  });

  const firstName = user.name.split(" ")[0];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={
          isManager
            ? "Agency-wide overview of bookings and activity."
            : "Your bookings and recent activity."
        }
      >
        <Button asChild>
          <Link href="/bookings/new">
            <Plus className="mr-2 size-4" />
            New booking
          </Link>
        </Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active bookings"
          value={active.length}
          hint={`${formatMoney(activeValue)} total value`}
          icon={Briefcase}
        />
        <StatCard
          label="Confirmed revenue"
          value={formatMoney(confirmedRevenue)}
          hint="Confirmed & paid"
          icon={Wallet}
        />
        <StatCard
          label="Upcoming trips"
          value={upcoming.length}
          hint={upcoming[0] ? `Next: ${formatDate(upcoming[0].departDate)}` : "None scheduled"}
          icon={Plane}
        />
        <StatCard
          label="Passport alerts"
          value={passportAlerts.length}
          hint={passportAlerts.length ? "Need attention" : "All clear"}
          icon={ShieldAlert}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Upcoming trips */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Upcoming trips</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/bookings">All bookings</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No upcoming trips.{" "}
                <Link href="/bookings/new" className="underline">
                  Create a booking
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y">
                {upcoming.slice(0, 6).map((b) => {
                  const meta = BOOKING_STATUS_META[b.status as BookingStatus];
                  return (
                    <li key={b.id} className="py-2.5">
                      <Link
                        href={`/bookings/${b.id}`}
                        className="flex items-center justify-between gap-3 hover:underline"
                      >
                        <span className="min-w-0">
                          <span className="font-medium">
                            {b.client?.name ?? b.destination ?? b.reference}
                          </span>
                          <span className="text-muted-foreground ml-2 text-xs">
                            {b.destination ?? ""}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <span className="text-muted-foreground text-xs">
                            {formatDate(b.departDate)}
                          </span>
                          <StatusBadge label={meta?.label ?? b.status} tone={meta?.badgeClass} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Passport alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="size-4" /> Passport alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {passportAlerts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No passport issues on upcoming bookings.
              </p>
            ) : (
              <ul className="space-y-3">
                {passportAlerts.slice(0, 6).map((a, i) => (
                  <li key={`${a.bookingId}-${i}`}>
                    <Link href={`/bookings/${a.bookingId}`} className="block hover:underline">
                      <p
                        className={
                          a.level === "expired"
                            ? "text-sm font-medium text-red-600 dark:text-red-400"
                            : "text-sm font-medium text-amber-600 dark:text-amber-400"
                        }
                      >
                        {a.traveller}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {a.reference} · {a.message}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4" />
            {isManager ? "Team activity" : "Your activity"}
          </CardTitle>
          {isManager && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/team">View team</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {activities.map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <Avatar className="mt-0.5 size-7">
                    <AvatarFallback className="text-xs">
                      {initials(a.user?.name ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{a.user?.name ?? "Someone"}</span>{" "}
                      {describeActivity(a)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatRelative(a.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
