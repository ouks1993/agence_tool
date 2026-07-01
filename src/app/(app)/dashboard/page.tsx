import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, gte } from "drizzle-orm";
import {
  Briefcase,
  GitBranch,
  Plane,
  ListChecks,
  Plus,
  Activity,
  TrendingUp,
  MapPin,
  CalendarClock,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { GettingStartedCard } from "@/components/app/getting-started-card";
import { PageHeader } from "@/components/app/page-header";
import { StatStrip } from "@/components/app/stat-strip";
import { FunnelInsight, HBarInsight } from "@/components/charts/insight-charts";
import { ActivityTimeline } from "@/components/dashboard/activity-timeline";
import { AtlasSuggests, type Suggestion } from "@/components/dashboard/atlas-suggests";
import { BookingsStatusPanel } from "@/components/dashboard/bookings-status-panel";
import { DeparturesList, type DepartureRow } from "@/components/dashboard/departures-list";
import { FollowUpsList, type FollowUpItem } from "@/components/dashboard/follow-ups-list";
import { RevenueTrend } from "@/components/dashboard/revenue-trend";
import { SectionCard } from "@/components/dashboard/section-card";
import { TopDestinations, type DestinationRow } from "@/components/dashboard/top-destinations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  conversionRate,
  countBy,
  growthPct,
  headlineTotal,
  monthlyBuckets,
  num,
  sumByCurrency,
  topN,
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
  formatMoneyCompact,
  formatDate,
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
import { statusTone } from "@/lib/status-tone";
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
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // --- Operational "act-today" counts (cheap agency-scoped COUNT(*)s) -------
  // Proposals awaiting a client response (product.status = "sent") and clients
  // created in the current calendar month. Same RBAC as the rest of the page:
  // agents see only records they created, full-visibility roles the whole agency.
  const [proposalsSentCount, newClientsThisMonth] = await Promise.all([
    db.$count(
      product,
      and(
        eq(product.agencyId, user.agencyId),
        eq(product.status, "sent"),
        canSeeAll ? undefined : eq(product.createdById, user.id)
      )
    ),
    db.$count(
      clientTable,
      and(
        eq(clientTable.agencyId, user.agencyId),
        gte(clientTable.createdAt, monthStart),
        canSeeAll ? undefined : eq(clientTable.createdById, user.id)
      )
    ),
  ]);

  // Departures in the next 7 days — non-cancelled bookings departing in
  // [today, today+7] (derived from the already-loaded rows).
  const in7Days = new Date(now.getTime() + 7 * 86_400_000);
  const departuresNext7 = active.filter((b) => {
    if (!b.departDate) return false;
    const d = new Date(b.departDate);
    return !Number.isNaN(d.getTime()) && d >= now && d <= in7Days;
  }).length;

  // Overdue receivables — DZD headline Σ of positive balances on bookings whose
  // departure has already passed (mirrors the finance/receivables logic).
  const overdueByCurrency = sumByCurrency(
    active.filter((b) => b.departDate && new Date(b.departDate) < now),
    (b) => {
      const { balance } = paymentSummary(b.payments, num(b.totalAmount));
      return balance > 0 ? balance : 0;
    },
    (b) => b.currency || "DZD"
  );
  const overdueTotal = headlineTotal(overdueByCurrency);

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
  // Confirmed-booking COUNT per month, same 12-month window — powers the
  // Revenue | Bookings series toggle on the revenue card.
  const bookingsMonthly = monthlyBuckets(
    confirmedBookings,
    (b) => b.createdAt,
    () => 1,
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

  // --- Forward-looking: "Closing this month" (DZD, currency-safe) ----------
  // Open-stage opportunities whose expected close date lands in the current
  // calendar month — the top deals by value, plus the month's open total. DZD
  // only (no FX); non-DZD deals are excluded rather than mis-summed.
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const closingThisMonth = dzdOpps.filter((o) => {
    if (!isOpenStage(o.stage) || !o.expectedCloseDate) return false;
    const c = new Date(o.expectedCloseDate);
    return !Number.isNaN(c.getTime()) && c >= monthStart && c < monthEnd;
  });
  const closingRows = topN(
    closingThisMonth,
    (o) => o.title,
    (o) => num(o.value),
    6
  );
  const closingTotal = closingThisMonth.reduce((s, o) => s + num(o.value), 0);

  // --- Top destinations by revenue THIS MONTH (DZD, currency-safe) --------
  // Confirmed & paid DZD bookings created this calendar month, grouped by the
  // destination country. Currency-safe: only the DZD series is summed.
  const countryOf = (raw: string | null | undefined) =>
    raw
      ? raw.includes(",")
        ? raw.slice(raw.lastIndexOf(",") + 1).trim() || raw
        : raw
      : "Unknown";
  const destThisMonth = dzdConfirmed.filter(
    (b) => new Date(b.createdAt) >= monthStart
  );
  const destTotals = topN(
    destThisMonth,
    (b) => countryOf(b.destination),
    (b) => num(b.totalAmount),
    5
  );
  const destTotalRevenue = destTotals.reduce((s, d) => s + d.value, 0);
  const destinationRows: DestinationRow[] = destTotals.map((d) => ({
    ...d,
    display: formatMoneyCompact(d.value),
    share: destTotalRevenue
      ? Math.round((d.value / destTotalRevenue) * 1000) / 10
      : 0,
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
      statusTone: statusTone("booking", b.status),
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

  // --- "Atlas suggests" — actionable cards DERIVED from real records ------
  // 1) The largest outstanding balance on an upcoming booking → chase it.
  // 2) The open opportunity closing soonest (highest value on ties) → convert.
  // 3) An expired-passport traveller on an upcoming trip → re-check.
  // Each links straight to the underlying record; nothing is fabricated.
  const suggestions: Suggestion[] = [];
  const daysUntil = (d: Date) =>
    Math.max(0, Math.round((d.getTime() - now.getTime()) / 86_400_000));

  // 1) Biggest outstanding balance (prefer bookings that depart soon).
  let topBalance: {
    id: string;
    reference: string;
    balance: number;
    currency: string;
    departDate: Date | null;
    total: number;
  } | null = null;
  for (const b of active) {
    const total = num(b.totalAmount);
    const { balance } = paymentSummary(b.payments, total);
    if (balance <= 0.005) continue;
    if (!topBalance || balance > topBalance.balance) {
      topBalance = {
        id: b.id,
        reference: b.reference,
        balance,
        currency: b.currency || "DZD",
        departDate: b.departDate ? new Date(b.departDate) : null,
        total,
      };
    }
  }
  if (topBalance) {
    const pct = topBalance.total
      ? Math.round((topBalance.balance / topBalance.total) * 100)
      : null;
    const departsIn =
      topBalance.departDate && topBalance.departDate >= now
        ? ` before it departs in ${daysUntil(topBalance.departDate)} day${
            daysUntil(topBalance.departDate) === 1 ? "" : "s"
          }`
        : "";
    suggestions.push({
      id: `sg-balance-${topBalance.id}`,
      kind: "balance",
      title: `Chase ${formatMoney(topBalance.balance, topBalance.currency)} on ${topBalance.reference}`,
      description: `${topBalance.reference} still has ${
        pct !== null ? `${pct}% ` : "an "
      }outstanding balance${departsIn}. Sending the payment link now protects the allotment.`,
      actionLabel: "Collect balance",
      actionHref: `/bookings/${topBalance.id}`,
    });
  }

  // 2) Open opportunity closing soonest (within ~30 days), highest value wins ties.
  const closingSoon = opps
    .filter((o) => isOpenStage(o.stage) && o.expectedCloseDate)
    .map((o) => ({ ...o, close: new Date(o.expectedCloseDate as string | Date) }))
    .filter((o) => !Number.isNaN(o.close.getTime()) && o.close <= new Date(now.getTime() + 30 * 86_400_000))
    .sort(
      (a, b) => a.close.getTime() - b.close.getTime() || num(b.value) - num(a.value)
    );
  const nextClose = closingSoon[0];
  if (nextClose) {
    const overdue = nextClose.close < now;
    const valueStr =
      (nextClose.currency || "DZD") === "DZD" && num(nextClose.value) > 0
        ? ` — ${formatMoney(num(nextClose.value), nextClose.currency || "DZD")}`
        : "";
    suggestions.push({
      id: `sg-opp-${nextClose.id}`,
      kind: "proposal",
      title: overdue
        ? `Revive ${nextClose.title} — close date passed`
        : `Convert ${nextClose.title} closing in ${daysUntil(nextClose.close)} day${daysUntil(nextClose.close) === 1 ? "" : "s"}`,
      description: `This deal${valueStr} is still open and ${
        overdue
          ? `overdue since ${formatDate(nextClose.close)}`
          : `due to close ${formatDate(nextClose.close)}`
      }. A nudge now could win it before it slips.`,
      actionLabel: "Follow up",
      actionHref: `/opportunities/${nextClose.id}`,
    });
  }

  // 3) An expired-passport traveller on an upcoming trip → re-check.
  const expiredPassport = passportAlerts.find((a) => a.level === "expired");
  if (expiredPassport) {
    suggestions.push({
      id: `sg-passport-${expiredPassport.bookingId}`,
      kind: "passport",
      title: `Re-verify passport — ${expiredPassport.traveller}`,
      description: `${expiredPassport.reference}: ${expiredPassport.message}. Fix this before ticketing to avoid a denied boarding.`,
      actionLabel: "Open booking",
      actionHref: `/bookings/${expiredPassport.bookingId}`,
    });
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
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6">
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
      <StatStrip
        items={[
          {
            label: "Revenue this month",
            value: formatMoneyCompact(revenueThisMonth),
            ...(revenueDelta ? { delta: revenueDelta } : {}),
          },
          {
            label: "Confirmed bookings",
            value: confirmedThisMonth,
            ...(confirmedDelta ? { delta: confirmedDelta } : {}),
          },
          {
            label: "Pipeline value",
            value: formatMoneyCompact(pipelineValue),
          },
          {
            label: "Conversion",
            value: `${convRate}%`,
          },
        ]}
      />

      {/* Operational "act-today" band — what needs doing right now */}
      <StatStrip
        items={[
          {
            label: "Departures next 7 days",
            value: departuresNext7,
          },
          {
            label: "Proposals awaiting response",
            value: proposalsSentCount,
          },
          {
            label: "Overdue",
            value: formatMoneyCompact(overdueTotal),
            ...(overdueTotal > 0 ? { tone: "text-warning" } : {}),
          },
          {
            label: "New clients this month",
            value: newClientsThisMonth,
          },
        ]}
      />

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
            bookingsData={bookingsMonthly}
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
            <span className="text-muted-foreground text-sm">Proposal win rate</span>
            <Badge variant="success" dot className="tabular-nums">
              {convRate}%
            </Badge>
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

      {/* Forward-looking — deals expected to close in the current month (DZD) */}
      <SectionCard
        icon={CalendarClock}
        title="Closing this month"
        subtitle={
          closingThisMonth.length
            ? `${formatMoney(closingTotal)} across ${closingThisMonth.length} open deal${
                closingThisMonth.length === 1 ? "" : "s"
              }`
            : "No deals expected to close this month"
        }
        actionHref="/opportunities"
        actionLabel="View pipeline"
      >
        {closingRows.length === 0 ? (
          <p className="text-muted-foreground py-2 text-sm">
            No open opportunities with an expected close date this month.{" "}
            <Link href="/opportunities/new" className="underline">
              Add an opportunity
            </Link>
            .
          </p>
        ) : (
          <HBarInsight data={closingRows} format="currency" color="var(--chart-4)" />
        )}
      </SectionCard>

      {/* Row 3 — Recent activity (2fr) + Atlas suggests / Top destinations stack */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="card-elevated lg:col-span-2">
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
              <ActivityTimeline items={activities} />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {suggestions.length > 0 && <AtlasSuggests suggestions={suggestions} />}

          <SectionCard
            icon={MapPin}
            title="Top destinations"
            subtitle="By revenue this month"
          >
            <TopDestinations rows={destinationRows} />
          </SectionCard>
        </div>
      </div>

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
