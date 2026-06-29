import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import {
  Briefcase,
  Wallet,
  GitBranch,
  Percent,
  Plane,
  ListChecks,
  Plus,
  Activity,
  TrendingUp,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { GettingStartedCard } from "@/components/app/getting-started-card";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { FunnelInsight } from "@/components/charts/insight-charts";
import { BookingsStatusPanel } from "@/components/dashboard/bookings-status-panel";
import { DeparturesList, type DepartureRow } from "@/components/dashboard/departures-list";
import { FollowUpsList, type FollowUpItem } from "@/components/dashboard/follow-ups-list";
import { RevenueTrend } from "@/components/dashboard/revenue-trend";
import { SectionCard } from "@/components/dashboard/section-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describeActivity } from "@/lib/activity-format";
import {
  conversionRate,
  countBy,
  growthPct,
  monthlyBuckets,
  num,
} from "@/lib/analytics";
import { db } from "@/lib/db";
import {
  BOOKING_STATUS_META,
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_META,
  OPEN_STAGES,
  roleHome,
  seesAllData,
  type BookingStatus,
  type OpportunityStage,
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
import {
  booking,
  activityLog,
  opportunity,
  product,
  client as clientTable,
  agency,
} from "@/lib/schema";
import {
  DashboardInsights,
  DashboardInsightsSkeleton,
} from "./dashboard-insights";

export const metadata = { title: "Dashboard" };

const SHORT_MONTH = new Intl.DateTimeFormat("en-GB", { month: "short" });

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
        // SQL COUNT(*) per table rather than fetching every id and taking .length.
        db.$count(clientTable, eq(clientTable.agencyId, user.agencyId)),
        db.$count(opportunity, eq(opportunity.agencyId, user.agencyId)),
        db.$count(product, eq(product.agencyId, user.agencyId)),
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

  // Opportunities (agency-scoped; agents see only deals assigned to them). Used
  // for the hero pipeline KPIs, the conversion rate, the funnel-by-value card,
  // and the "follow up" follow-up signals. Same RBAC pattern as the
  // opportunities page (assignedToId for agents).
  const opps = await db
    .select({
      id: opportunity.id,
      title: opportunity.title,
      value: opportunity.value,
      currency: opportunity.currency,
      stage: opportunity.stage,
      expectedCloseDate: opportunity.expectedCloseDate,
      createdAt: opportunity.createdAt,
    })
    .from(opportunity)
    .where(
      and(
        eq(opportunity.agencyId, user.agencyId),
        canSeeAll ? undefined : eq(opportunity.assignedToId, user.id)
      )
    );

  const active = bookings.filter((b) => b.status !== "cancelled");
  // Confirmed & paid (kept exactly as before — "paid" is a historical alias).
  const confirmedBookings = bookings.filter(
    (b) => b.status === "confirmed" || b.status === "paid"
  );

  const now = new Date();

  // --- Hero KPI derivations (DZD-only money, no FX) ------------------------
  // Revenue this month + MoM delta — confirmed & paid bookings, DZD, by createdAt.
  const dzdConfirmed = confirmedBookings.filter((b) => (b.currency || "DZD") === "DZD");
  const revenueBuckets = monthlyBuckets(
    dzdConfirmed,
    (b) => b.createdAt,
    (b) => num(b.totalAmount),
    2,
    now
  );
  const revenueThisMonth = revenueBuckets[1]?.value ?? 0;
  const revenueLastMonth = revenueBuckets[0]?.value ?? 0;
  const revenueGrowth = growthPct(revenueThisMonth, revenueLastMonth);

  // Confirmed-bookings count this month + MoM delta (count-based).
  const confirmedCountBuckets = monthlyBuckets(
    confirmedBookings,
    (b) => b.createdAt,
    () => 1,
    2,
    now
  );
  const confirmedThisMonth = confirmedCountBuckets[1]?.value ?? 0;
  const confirmedLastMonth = confirmedCountBuckets[0]?.value ?? 0;
  const confirmedGrowth = growthPct(confirmedThisMonth, confirmedLastMonth);

  // Pipeline value — Σ value of OPEN-stage opportunities (DZD).
  const isOpenStage = (s: string) =>
    OPEN_STAGES.includes(s as (typeof OPEN_STAGES)[number]);
  const dzdOpps = opps.filter((o) => (o.currency || "DZD") === "DZD");
  const pipelineValue = dzdOpps
    .filter((o) => isOpenStage(o.stage))
    .reduce((s, o) => s + num(o.value), 0);
  const openDealCount = opps.filter((o) => isOpenStage(o.stage)).length;

  // Conversion — won ÷ closed (won + lost) deals.
  const wonCount = opps.filter((o) => o.stage === "won").length;
  const closedCount = opps.filter(
    (o) => o.stage === "won" || o.stage === "lost"
  ).length;
  const convRate = conversionRate(wonCount, closedCount);

  // --- Revenue evolution chart — last 12 months, DZD ----------------------
  const revenueMonthly = monthlyBuckets(
    dzdConfirmed,
    (b) => b.createdAt,
    (b) => num(b.totalAmount),
    12,
    now
  );

  // --- Bookings-by-status donut + summary figures -------------------------
  const byStatus = countBy(
    bookings,
    (b) => BOOKING_STATUS_META[b.status as BookingStatus]?.label ?? b.status,
    8
  );
  let outstandingTotal = 0;
  for (const b of bookings) {
    const { balance } = paymentSummary(b.payments, num(b.totalAmount));
    if (balance > 0) outstandingTotal += balance;
  }
  const dzdActive = active.filter((b) => (b.currency || "DZD") === "DZD");
  const avgBookingValue = dzdActive.length
    ? Math.round(
        dzdActive.reduce((s, b) => s + num(b.totalAmount), 0) / dzdActive.length
      )
    : 0;

  // --- Pipeline funnel by value across stages (DZD) + win rate ------------
  const funnel = OPPORTUNITY_STAGES.filter((s) => s !== "lost").map((s) => ({
    label: OPPORTUNITY_STAGE_META[s as OpportunityStage].label,
    value: dzdOpps
      .filter((o) => o.stage === s)
      .reduce((sum, o) => sum + num(o.value), 0),
  }));

  // --- Upcoming departures ------------------------------------------------
  const upcoming = bookings
    .filter((b) => b.departDate && new Date(b.departDate) >= now && b.status !== "cancelled")
    .sort(
      (a, b) => new Date(a.departDate!).getTime() - new Date(b.departDate!).getTime()
    );

  const departureRows: DepartureRow[] = upcoming.slice(0, 5).map((b) => {
    const d = new Date(b.departDate!);
    const meta = BOOKING_STATUS_META[b.status as BookingStatus];
    const place = b.destination ?? "";
    return {
      id: b.id,
      day: String(d.getDate()).padStart(2, "0"),
      month: SHORT_MONTH.format(d),
      title: b.client?.name ?? b.destination ?? b.reference,
      subline: [place, b.reference].filter(Boolean).join(" · "),
      statusLabel: meta?.label ?? b.status,
      statusTone: meta?.badgeClass,
    };
  });

  // --- Passport alerts across non-cancelled bookings ----------------------
  const passportAlerts: {
    bookingId: string;
    reference: string;
    traveller: string;
    message: string;
    level: "warning" | "expired";
  }[] = [];
  for (const b of active) {
    for (const tr of b.travellers) {
      const status = passportExpiryStatus(tr.passportExpiry, b.departDate);
      if (status.level === "warning" || status.level === "expired") {
        passportAlerts.push({
          bookingId: b.id,
          reference: b.reference,
          traveller: tr.fullName,
          message: status.message,
          level: status.level,
        });
      }
    }
  }

  // --- Needs-attention / follow-ups (DERIVED from real signals) -----------
  // 1) Bookings with an outstanding balance > 0 → "Collect balance".
  // 2) Open opportunities with an expected close date within ~7 days → "Follow up".
  // 3) Passport alerts (expired = high, warning = medium).
  const followUps: FollowUpItem[] = [];
  const soon = new Date(now.getTime() + 7 * 86_400_000);

  for (const b of active) {
    const { balance } = paymentSummary(b.payments, num(b.totalAmount));
    if (balance > 0.005) {
      followUps.push({
        id: `bal-${b.id}`,
        href: `/bookings/${b.id}`,
        title: `Collect balance on ${b.reference}`,
        meta: `${formatMoney(balance, b.currency || "DZD")} due${
          b.departDate ? ` · departs ${formatDate(b.departDate)}` : ""
        }`,
        priority: "high",
      });
    }
  }

  for (const o of opps) {
    if (!isOpenStage(o.stage) || !o.expectedCloseDate) continue;
    const close = new Date(o.expectedCloseDate);
    if (Number.isNaN(close.getTime()) || close > soon) continue;
    const overdue = close < now;
    followUps.push({
      id: `opp-${o.id}`,
      href: `/opportunities/${o.id}`,
      title: `Follow up ${o.title}`,
      meta: overdue
        ? `Close date passed ${formatDate(close)}`
        : `Closes ${formatDate(close)}`,
      priority: overdue ? "high" : "medium",
    });
  }

  for (const a of passportAlerts) {
    followUps.push({
      id: `pass-${a.bookingId}-${a.traveller}`,
      href: `/bookings/${a.bookingId}`,
      title: `Passport check — ${a.traveller}`,
      meta: `${a.reference} · ${a.message}`,
      priority: a.level === "expired" ? "high" : "low",
    });
  }

  const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;
  followUps.sort((x, y) => PRIORITY_RANK[x.priority] - PRIORITY_RANK[y.priority]);
  const dueSoonCount = followUps.filter((f) => f.priority === "high").length;

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

  // Manager/admin insights are computed in a separate async child component
  // (DashboardInsights) wrapped in <Suspense> below, so the page shell — KPIs,
  // upcoming trips, activity — streams to the browser without waiting on the
  // insights-only queries (team members, client sources, opportunities).

  const firstName = user.name.split(" ")[0] ?? user.name;

  // Pre-build optional delta pills so we never pass an explicit `undefined`
  // (the project uses exactOptionalPropertyTypes).
  const revenueDelta =
    revenueGrowth !== null
      ? {
          value: `${revenueGrowth > 0 ? "+" : ""}${revenueGrowth}%`,
          direction: (revenueGrowth >= 0 ? "up" : "down") as "up" | "down",
          caption: "vs last month",
        }
      : null;
  const confirmedDelta =
    confirmedGrowth !== null
      ? {
          value: `${confirmedGrowth > 0 ? "+" : ""}${confirmedGrowth}%`,
          direction: (confirmedGrowth >= 0 ? "up" : "down") as "up" | "down",
          caption: "vs last month",
        }
      : null;

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
              href: "/proposals/new",
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

      {/* Hero KPI row — revenue, confirmed bookings, pipeline, conversion */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenue this month"
          value={formatMoney(revenueThisMonth)}
          icon={Wallet}
          hint="Confirmed & paid"
          {...(revenueDelta ? { delta: revenueDelta } : {})}
        />
        <StatCard
          label="Confirmed bookings"
          value={confirmedThisMonth}
          icon={Briefcase}
          hint={`${confirmedBookings.length} confirmed all-time`}
          {...(confirmedDelta ? { delta: confirmedDelta } : {})}
        />
        <StatCard
          label="Pipeline value"
          value={formatMoney(pipelineValue)}
          icon={GitBranch}
          hint={`${openDealCount} open deal${openDealCount === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Conversion"
          value={`${convRate}%`}
          icon={Percent}
          hint="Won ÷ closed deals"
        />
      </div>

      {/* Row 1 — Revenue evolution (2fr) + Bookings by status (1fr) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          icon={TrendingUp}
          title="Revenue"
          subtitle="Confirmed revenue · last 12 months"
        >
          <RevenueTrend
            data={revenueMonthly}
            headline={formatMoney(revenueThisMonth)}
            {...(revenueDelta
              ? { deltaLabel: revenueDelta.value, deltaDirection: revenueDelta.direction }
              : {})}
          />
        </SectionCard>

        <SectionCard
          icon={Briefcase}
          title="Bookings by status"
          subtitle={`${active.length} active booking${active.length === 1 ? "" : "s"}`}
        >
          <BookingsStatusPanel
            data={byStatus}
            outstanding={formatMoney(outstandingTotal)}
            avgBookingValue={formatMoney(avgBookingValue)}
          />
        </SectionCard>
      </div>

      {/* Row 2 — Pipeline funnel + Upcoming departures + Follow-ups */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard
          icon={GitBranch}
          title="Pipeline funnel"
          subtitle={`${formatMoney(pipelineValue)} open · ${openDealCount} deal${
            openDealCount === 1 ? "" : "s"
          }`}
        >
          {funnel.every((f) => f.value === 0) ? (
            <p className="text-muted-foreground text-sm">
              No pipeline value yet.{" "}
              <Link href="/opportunities/new" className="underline">
                Add an opportunity
              </Link>
              .
            </p>
          ) : (
            <FunnelInsight data={funnel} format="currency" />
          )}
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <span className="text-muted-foreground text-sm">Win rate</span>
            <span className="text-sm font-semibold tabular-nums">{convRate}%</span>
          </div>
        </SectionCard>

        <SectionCard
          icon={Plane}
          title="Upcoming departures"
          subtitle={upcoming.length ? `Next ${departureRows.length} trips` : "None scheduled"}
          actionHref="/bookings"
          actionLabel="View all"
          bodyClassName="py-2"
        >
          {departureRows.length === 0 ? (
            <p className="text-muted-foreground py-2 text-sm">
              No upcoming trips.{" "}
              <Link href="/bookings/new" className="underline">
                Create a booking
              </Link>
              .
            </p>
          ) : (
            <DeparturesList rows={departureRows} />
          )}
        </SectionCard>

        <SectionCard
          icon={ListChecks}
          title="Needs attention"
          subtitle={
            followUps.length
              ? `${followUps.length} open · ${dueSoonCount} urgent`
              : "All caught up"
          }
          bodyClassName="py-2"
        >
          {followUps.length === 0 ? (
            <p className="text-muted-foreground py-2 text-sm">
              Nothing needs attention right now.
            </p>
          ) : (
            <FollowUpsList items={followUps.slice(0, 6)} />
          )}
        </SectionCard>
      </div>

      {/* Recent activity */}
      <Card className="card-elevated">
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

      {/* Insights — manager/admin only (full-visibility roles). Rendered in a
          Suspense boundary so the shell above streams without waiting on the
          insights-only queries. */}
      {canSeeAll && (
        <Suspense fallback={<DashboardInsightsSkeleton />}>
          <DashboardInsights
            agencyId={user.agencyId}
            bookings={bookings}
            active={active}
          />
        </Suspense>
      )}
    </div>
  );
}
