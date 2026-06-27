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
  Percent,
  TrendingUp,
  Gauge,
  Users,
  Tag,
  MapPin,
  Globe,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import {
  BarInsight,
  DonutInsight,
  AreaInsight,
  HBarInsight,
  type Point,
} from "@/components/charts/insight-charts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describeActivity } from "@/lib/activity-format";
import { db } from "@/lib/db";
import {
  BOOKING_STATUS_META,
  LEAD_SOURCE_LABEL,
  roleHome,
  seesAllData,
  type BookingStatus,
  type LeadSource,
} from "@/lib/domain";
import {
  formatMoney,
  formatRelative,
  formatDate,
  initials,
  passportExpiryStatus,
} from "@/lib/format";
import {
  conversionRate,
  countBy,
  growthPct,
  monthlyBuckets,
  num,
  topN,
} from "@/lib/analytics";
import { paymentSummary } from "@/lib/payments/summary";
import { requireAgencyUser } from "@/lib/permissions";
import { booking, activityLog, opportunity, product, client as clientTable, user as userTable, agency } from "@/lib/schema";
import { GettingStartedCard } from "@/components/app/getting-started-card";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireAgencyUser();
  const t = await getTranslations("dashboard");

  // Finance/support roles have their own workspaces — send them there so the
  // generic dashboard stays the home for admin, manager and agent only.
  const home = roleHome(user.role);
  if (home !== "/dashboard") redirect(home);

  const canSeeAll = seesAllData(user.role);

  // Quick counts + dismissed state for the getting-started checklist (admin/manager only).
  const [clientCount, opportunityCount, productCount, agencyRow] = canSeeAll
    ? await Promise.all([
        db.select({ id: clientTable.id }).from(clientTable).where(eq(clientTable.agencyId, user.agencyId)).then((r) => r.length),
        db.select({ id: opportunity.id }).from(opportunity).where(eq(opportunity.agencyId, user.agencyId)).then((r) => r.length),
        db.select({ id: product.id }).from(product).where(eq(product.agencyId, user.agencyId)).then((r) => r.length),
        db.query.agency.findFirst({ where: eq(agency.id, user.agencyId), columns: { onboardingDismissedAt: true } }),
      ])
    : [1, 1, 1, null]; // agents skip the checklist

  const onboardingDismissed = Boolean((agencyRow as { onboardingDismissedAt: Date | null } | null | undefined)?.onboardingDismissedAt);

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
    revenueByAgent: Point[];
    revenueMonthly: Point[];
    topClients: Point[];
    leadSources: Point[];
    sourceMarkets: Point[];
    totalRevenue: number;
    collected: number;
    outstanding: number;
    wonPipeline: number;
    conversionRate: number;
    avgBookingValue: number;
    revenueGrowth: number | null;
  };
  let insights: Insights | null = null;

  if (canSeeAll) {
    // Revenue basis for monetary charts: non-cancelled bookings in DZD (the
    // agency currency). No FX, so any non-DZD booking is excluded from money
    // charts rather than mis-summed.
    const dzdActive = active.filter((b) => (b.currency || "DZD") === "DZD");
    // "Country" label from "Marrakech, Morocco" → "Morocco" (heuristic until
    // destinations are structured in Phase 3).
    const countryOf = (raw: string | null | undefined) =>
      raw
        ? raw.includes(",")
          ? raw.slice(raw.lastIndexOf(",") + 1).trim() || raw
          : raw
        : "Unknown";

    // 1) Top destinations by REVENUE (was: count).
    const byDestination = topN(dzdActive, (b) => countryOf(b.destination), (b) => num(b.totalAmount), 8);

    // 2) Bookings by status — count donut (currency-agnostic).
    const byStatus = countBy(bookings, (b) => BOOKING_STATUS_META[b.status as BookingStatus]?.label ?? b.status, 8);

    // 3) Revenue per agent (was: booking count). Map createdById → first name.
    const members = await db
      .select({ id: userTable.id, name: userTable.name })
      .from(userTable)
      .where(eq(userTable.agencyId, user.agencyId));
    const memberName = new Map(members.map((m) => [m.id, m.name.split(" ")[0] || m.name]));
    const revenueByAgent = topN(
      dzdActive,
      (b) => (b.createdById ? memberName.get(b.createdById) ?? "Unknown" : "Unassigned"),
      (b) => num(b.totalAmount),
      8
    );

    // 4) Revenue evolution — last 6 months by createdAt, DZD (was: count).
    const revenueMonthly = monthlyBuckets(dzdActive, (b) => b.createdAt, (b) => num(b.totalAmount), 6);

    // 5) Top clients by revenue.
    const topClients = topN(dzdActive, (b) => b.client?.name, (b) => num(b.totalAmount), 8);

    // 6) Lead-source breakdown (by client count). Uses free-text source today;
    // becomes clean once Phase 2 makes it an enum.
    const sourceRows = await db
      .select({ source: clientTable.source, country: clientTable.country })
      .from(clientTable)
      .where(eq(clientTable.agencyId, user.agencyId));
    const leadSources = countBy(
      sourceRows,
      (r) => (r.source ? LEAD_SOURCE_LABEL[r.source as LeadSource] ?? r.source : "Unknown"),
      6
    );
    // Top source markets — clients grouped by country (clean now that country
    // is picked from the ISO list).
    const sourceMarkets = countBy(sourceRows, (r) => r.country, 8);

    // Finance KPIs.
    const totalRevenue = dzdActive
      .filter((b) => b.status === "confirmed")
      .reduce((s, b) => s + num(b.totalAmount), 0);

    let collected = 0;
    let outstanding = 0;
    for (const b of bookings) {
      const total = num(b.totalAmount);
      const { paid, balance } = paymentSummary(b.payments, total);
      collected += paid;
      if (balance > 0) outstanding += balance;
    }

    // Won pipeline + conversion rate (all opportunities, agency-scoped).
    const allOpps = await db
      .select({ value: opportunity.value, stage: opportunity.stage })
      .from(opportunity)
      .where(eq(opportunity.agencyId, user.agencyId));
    const wonOpps = allOpps.filter((o) => o.stage === "won");
    const wonPipeline = wonOpps.reduce((s, o) => s + num(o.value), 0);
    // Conversion = won ÷ closed (won + lost) deals.
    const closedOpps = allOpps.filter((o) => o.stage === "won" || o.stage === "lost").length;
    const convRate = conversionRate(wonOpps.length, closedOpps);

    // Average booking value (non-cancelled, DZD).
    const avgBookingValue = dzdActive.length
      ? Math.round(dzdActive.reduce((s, b) => s + num(b.totalAmount), 0) / dzdActive.length)
      : 0;

    // MoM revenue growth from the last two month buckets.
    const lastTwo = revenueMonthly.slice(-2);
    const revenueGrowth =
      lastTwo.length === 2 ? growthPct(lastTwo[1]!.value, lastTwo[0]!.value) : null;

    insights = {
      byDestination,
      byStatus,
      revenueByAgent,
      revenueMonthly,
      topClients,
      leadSources,
      sourceMarkets,
      totalRevenue,
      collected,
      outstanding,
      wonPipeline,
      conversionRate: convRate,
      avgBookingValue,
      revenueGrowth,
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

      {/* Getting started checklist — shown to admin/manager on a fresh agency */}
      {canSeeAll && (
        <GettingStartedCard
          initialDismissed={onboardingDismissed}
          steps={[
            {
              label: "Add your first client",
              description: "Create a client record before building bookings or proposals.",
              href: "/clients/new",
              done: clientCount > 0,
            },
            {
              label: "Create an opportunity",
              description: "Track a sales lead through your pipeline.",
              href: "/opportunities/new",
              done: opportunityCount > 0,
            },
            {
              label: "Build a proposal",
              description: "Quote a trip package and share it with your client.",
              href: "/products/new",
              done: productCount > 0,
            },
            {
              label: "Create a booking",
              description: "Start a booking file with travellers and trip services.",
              href: "/bookings/new",
              done: bookings.length > 0,
            },
          ]}
        />
      )}

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

          {/* Performance KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Conversion rate"
              value={`${insights.conversionRate}%`}
              hint="Won ÷ closed deals"
              icon={Percent}
            />
            <StatCard
              label="Avg booking value"
              value={formatMoney(insights.avgBookingValue)}
              hint="Across active bookings"
              icon={Gauge}
            />
            <StatCard
              label="Revenue growth"
              value={
                insights.revenueGrowth === null
                  ? "—"
                  : `${insights.revenueGrowth > 0 ? "+" : ""}${insights.revenueGrowth}%`
              }
              hint="Month over month"
              icon={TrendingUp}
            />
          </div>

          {/* Charts — only shown when there is data to display */}
          {bookings.length > 0 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="size-4" /> Revenue evolution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AreaInsight data={insights.revenueMonthly} format="currency" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="size-4" /> Top destinations by revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <HBarInsight data={insights.byDestination} format="currency" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="size-4" /> Top clients by revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <HBarInsight data={insights.topClients} format="currency" color="var(--chart-3)" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="size-4" /> Revenue per agent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <BarInsight data={insights.revenueByAgent} format="currency" color="var(--chart-2)" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Briefcase className="size-4" /> Bookings by status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DonutInsight data={insights.byStatus} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Tag className="size-4" /> Lead sources
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DonutInsight data={insights.leadSources} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Globe className="size-4" /> Top source markets
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <HBarInsight data={insights.sourceMarkets} color="var(--chart-5)" />
                </CardContent>
              </Card>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
