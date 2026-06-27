import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import {
  Briefcase,
  Wallet,
  Plane,
  ShieldAlert,
  Plus,
  Activity,
  BarChart3,
  Banknote,
  Coins,
  Trophy,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import {
  BarInsight,
  DonutInsight,
  AreaInsight,
  type Point,
} from "@/components/charts/insight-charts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describeActivity } from "@/lib/activity-format";
import { db } from "@/lib/db";
import {
  BOOKING_STATUS_META,
  roleHome,
  seesAllData,
  type BookingStatus,
} from "@/lib/domain";
import {
  formatMoney,
  formatRelative,
  formatDate,
  initials,
  passportExpiryStatus,
} from "@/lib/format";
import { paymentSummary } from "@/lib/payments/summary";
import { requireAgencyUser } from "@/lib/permissions";
import { booking, activityLog, opportunity, user as userTable } from "@/lib/schema";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireAgencyUser();
  const t = await getTranslations("dashboard");

  // Finance/support roles have their own workspaces — send them there so the
  // generic dashboard stays the home for admin, manager and agent only.
  const home = roleHome(user.role);
  if (home !== "/dashboard") redirect(home);

  const canSeeAll = seesAllData(user.role);

  // Bookings (agency-scoped ALWAYS; full-visibility roles see the whole agency,
  // agents see only the bookings they created within their agency).
  const bookings = await db.query.booking.findMany({
    where: canSeeAll
      ? eq(booking.agencyId, user.agencyId)
      : and(
          eq(booking.agencyId, user.agencyId),
          eq(booking.createdById, user.id)
        ),
    with: {
      client: { columns: { id: true, name: true } },
      travellers: true,
      // Used by the manager-only insights section to compute collected revenue
      // and outstanding balances. paymentSummary only reads amount/kind/status.
      payments: { columns: { amount: true, kind: true, status: true } },
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
    where: canSeeAll
      ? eq(activityLog.agencyId, user.agencyId)
      : and(
          eq(activityLog.agencyId, user.agencyId),
          eq(activityLog.userId, user.id)
        ),
    with: { user: { columns: { name: true } } },
    orderBy: [desc(activityLog.createdAt)],
    limit: 10,
  });

  // ── Manager/admin insights ────────────────────────────────────────────────
  // Everything below is agency-scoped and only computed/rendered when the role
  // has full visibility. Agents never reach this branch.
  type Insights = {
    byDestination: Point[];
    byStatus: Point[];
    teamPerformance: Point[];
    monthly: Point[];
    totalRevenue: number;
    collected: number;
    outstanding: number;
    wonPipeline: number;
  };
  let insights: Insights | null = null;

  if (canSeeAll) {
    // 1) Bookings by destination (country) — non-cancelled, top 8 by count.
    const destinationCounts = new Map<string, number>();
    for (const b of active) {
      const raw = b.destination?.trim();
      // "Marrakech, Morocco" → "Morocco"; fall back to whole string or "Unknown".
      const label = raw
        ? raw.includes(",")
          ? raw.slice(raw.lastIndexOf(",") + 1).trim() || raw
          : raw
        : "Unknown";
      destinationCounts.set(label, (destinationCounts.get(label) ?? 0) + 1);
    }
    const byDestination: Point[] = [...destinationCounts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // 2) Bookings by status — all bookings, labelled via status meta.
    const statusCounts = new Map<BookingStatus, number>();
    for (const b of bookings) {
      const status = b.status as BookingStatus;
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    }
    const byStatus: Point[] = [...statusCounts.entries()].map(([status, value]) => ({
      label: BOOKING_STATUS_META[status]?.label ?? status,
      value,
    }));

    // 3) Team performance — bookings created per team member (top 8, skip zero).
    const members = await db
      .select({ id: userTable.id, name: userTable.name })
      .from(userTable)
      .where(eq(userTable.agencyId, user.agencyId));
    const createdByCounts = new Map<string, number>();
    for (const b of bookings) {
      if (!b.createdById) continue;
      createdByCounts.set(b.createdById, (createdByCounts.get(b.createdById) ?? 0) + 1);
    }
    const teamPerformance: Point[] = members
      .map((m) => ({
        // Prefer the first name for a compact axis label.
        label: m.name.split(" ")[0] || m.name,
        value: createdByCounts.get(m.id) ?? 0,
      }))
      .filter((p) => p.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // 4) Monthly bookings — last 6 months in chronological order, by createdAt.
    const SHORT_MONTHS = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const monthBuckets: { key: string; label: string; value: number }[] = [];
    const anchor = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
      monthBuckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: SHORT_MONTHS[d.getMonth()] ?? "",
        value: 0,
      });
    }
    const monthIndex = new Map(monthBuckets.map((m, i) => [m.key, i]));
    for (const b of bookings) {
      const created = new Date(b.createdAt);
      const key = `${created.getFullYear()}-${created.getMonth()}`;
      const idx = monthIndex.get(key);
      if (idx !== undefined) monthBuckets[idx]!.value += 1;
    }
    const monthly: Point[] = monthBuckets.map(({ label, value }) => ({ label, value }));

    // 5) Finance KPIs.
    // Total revenue: confirmed bookings' total amount.
    const totalRevenue = bookings
      .filter((b) => b.status === "confirmed")
      .reduce((s, b) => s + parseFloat(b.totalAmount || "0"), 0);

    // Collected & outstanding: derived from completed payments (refunds netted).
    let collected = 0;
    let outstanding = 0;
    for (const b of bookings) {
      const total = parseFloat(b.totalAmount || "0");
      const { paid, balance } = paymentSummary(b.payments, total);
      collected += paid;
      if (balance > 0) outstanding += balance;
    }

    // Won pipeline: sum of opportunity value where stage = "won" (agency-scoped).
    const wonOpportunities = await db
      .select({ value: opportunity.value })
      .from(opportunity)
      .where(
        and(
          eq(opportunity.agencyId, user.agencyId),
          eq(opportunity.stage, "won")
        )
      );
    const wonPipeline = wonOpportunities.reduce(
      (s, o) => s + parseFloat(o.value || "0"),
      0
    );

    insights = {
      byDestination,
      byStatus,
      teamPerformance,
      monthly,
      totalRevenue,
      collected,
      outstanding,
      wonPipeline,
    };
  }

  const firstName = user.name.split(" ")[0] ?? user.name;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={
          canSeeAll
            ? t("welcome", { name: firstName })
            : t("yourWorkTitle", { name: firstName })
        }
        description={canSeeAll ? t("overview") : t("yourWork")}
      >
        {bookings.length === 0 ? (
          <Button asChild>
            <Link href="/clients/new">
              <Plus className="mr-2 size-4" />
              Add your first client
            </Link>
          </Button>
        ) : (
          <Button asChild>
            <Link href="/bookings/new">
              <Plus className="mr-2 size-4" />
              {t("newBooking")}
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("activeBookings")}
          value={active.length}
          hint={`${formatMoney(activeValue)} total value`}
          icon={Briefcase}
        />
        <StatCard
          label={t("confirmedRevenue")}
          value={formatMoney(confirmedRevenue)}
          hint="Confirmed & paid"
          icon={Wallet}
        />
        <StatCard
          label={t("upcomingTrips")}
          value={upcoming.length}
          hint={upcoming[0] ? `Next: ${formatDate(upcoming[0].departDate)}` : "None scheduled"}
          icon={Plane}
        />
        <StatCard
          label={t("passportAlerts")}
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
            {canSeeAll ? t("teamActivity") : t("yourActivity")}
          </CardTitle>
          {canSeeAll && (
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

      {/* Insights — manager/admin only (full-visibility roles) */}
      {insights && (
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-muted-foreground size-5" />
            <h2 className="text-xl font-semibold tracking-tight">{t("insights")}</h2>
          </div>

          {/* Finance KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total revenue"
              value={formatMoney(insights.totalRevenue)}
              hint="Confirmed bookings"
              icon={Wallet}
            />
            <StatCard
              label="Collected"
              value={formatMoney(insights.collected)}
              hint="Completed payments, net of refunds"
              icon={Banknote}
            />
            <StatCard
              label="Outstanding"
              value={formatMoney(insights.outstanding)}
              hint="Balances still due"
              icon={Coins}
            />
            <StatCard
              label="Won pipeline"
              value={formatMoney(insights.wonPipeline)}
              hint="Opportunities marked won"
              icon={Trophy}
            />
          </div>

          {/* Charts — only shown when there is data to display */}
          {bookings.length > 0 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Bookings by destination</CardTitle>
                </CardHeader>
                <CardContent>
                  <BarInsight data={insights.byDestination} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Bookings by status</CardTitle>
                </CardHeader>
                <CardContent>
                  <DonutInsight data={insights.byStatus} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Team performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <BarInsight data={insights.teamPerformance} color="var(--chart-3)" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Monthly bookings</CardTitle>
                </CardHeader>
                <CardContent>
                  <AreaInsight data={insights.monthly} />
                </CardContent>
              </Card>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
