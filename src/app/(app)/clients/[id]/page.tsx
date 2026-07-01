import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  Pencil,
  Plus,
  Mail,
  Phone,
  MapPin,
  Building2,
  ChevronLeft,
  FileText,
  StickyNote,
  Globe,
  User as UserIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { StatusBadge } from "@/components/app/status-badge";
import { SparkLine } from "@/components/charts/insight-charts";
import { ClientAvatar } from "@/components/clients/client-avatar";
import {
  ClientProfileTabs,
  type DealRow,
  type TripRow,
} from "@/components/clients/client-profile-tabs";
import { type TimelineEvent } from "@/components/clients/client-timeline";
import { flagFor } from "@/components/clients/country-flag";
import { DeleteClientButton } from "@/components/clients/delete-client-button";
import { PortalInviteButton } from "@/components/clients/portal-invite-button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describeActivity } from "@/lib/activity-format";
import { db } from "@/lib/db";
import {
  CLIENT_STATUS_META,
  BOOKING_STATUS_META,
  OPPORTUNITY_STAGE_META,
  PRODUCT_STATUS_META,
  LEAD_SOURCE_LABEL,
  seesAllData,
  type ClientStatus,
  type BookingStatus,
  type OpportunityStage,
  type ProductStatus,
  type LeadSource,
} from "@/lib/domain";
import {
  formatDate,
  formatMoney,
  formatMoneyCompact,
  formatRelative,
} from "@/lib/format";
import { requireAgencyUser } from "@/lib/permissions";
import {
  activityLog,
  client,
  notification,
  opportunity,
  product,
} from "@/lib/schema";
import { cn } from "@/lib/utils";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAgencyUser();
  const t = await getTranslations("clients");
  const { id } = await params;

  const c = await db.query.client.findFirst({
    // Agents may only open their own clients (others see all).
    where: and(
      eq(client.id, id),
      eq(client.agencyId, user.agencyId),
      seesAllData(user.role) ? undefined : eq(client.ownerId, user.id)
    ),
    with: {
      owner: { columns: { id: true, name: true } },
      contacts: { orderBy: (t, { desc }) => [desc(t.isPrimary)] },
      bookings: {
        orderBy: (t) => [desc(t.createdAt)],
        with: { payments: true },
      },
    },
  });

  if (!c) notFound();

  // Linked opportunities and proposals for this client (agency-scoped).
  const [opportunities, proposals] = await Promise.all([
    db.query.opportunity.findMany({
      where: and(
        eq(opportunity.clientId, c.id),
        eq(opportunity.agencyId, user.agencyId)
      ),
      orderBy: (t) => [desc(t.createdAt)],
      limit: 10,
    }),
    db.query.product.findMany({
      where: and(
        eq(product.clientId, c.id),
        eq(product.agencyId, user.agencyId)
      ),
      orderBy: (t) => [desc(t.createdAt)],
      limit: 10,
    }),
  ]);

  // ---------------------------------------------------------------------------
  // Unified activity timeline: activity log + notifications + payments.
  // ---------------------------------------------------------------------------
  const bookingIds = c.bookings.map((b) => b.id);
  const opportunityIds = opportunities.map((o) => o.id);
  const productIds = proposals.map((p) => p.id);

  // All entity ids whose activity should surface on this client's timeline.
  const timelineEntityIds = [
    c.id,
    ...bookingIds,
    ...opportunityIds,
    ...productIds,
  ];

  const [activities, notifications] = await Promise.all([
    db.query.activityLog.findMany({
      where: and(
        eq(activityLog.agencyId, user.agencyId),
        inArray(activityLog.entityId, timelineEntityIds)
      ),
      orderBy: (t) => [desc(t.createdAt)],
      limit: 30,
    }),
    bookingIds.length > 0
      ? db.query.notification.findMany({
          where: and(
            eq(notification.agencyId, user.agencyId),
            inArray(notification.bookingId, bookingIds)
          ),
          orderBy: (t) => [desc(t.createdAt)],
          limit: 30,
        })
      : Promise.resolve([]),
  ]);

  // Resolve an activity entity to the record it links to, if any.
  const hrefForEntity = (entityType: string, entityId: string | null) => {
    if (!entityId) return undefined;
    switch (entityType) {
      case "client":
        return `/clients/${entityId}`;
      case "opportunity":
        return `/opportunities/${entityId}`;
      case "product":
        return `/proposals/${entityId}`;
      case "booking":
        return `/bookings/${entityId}`;
      default:
        return undefined;
    }
  };

  const timelineEvents: TimelineEvent[] = [
    ...activities.map(
      (a): TimelineEvent => ({
        id: `activity-${a.id}`,
        date: a.createdAt,
        label: describeActivity(a),
        kind: "activity",
        entityHref: hrefForEntity(a.entityType, a.entityId),
      })
    ),
    ...notifications.map(
      (n): TimelineEvent => ({
        id: `notification-${n.id}`,
        date: n.createdAt,
        label: n.subject ?? n.kind,
        kind: "notification",
        entityHref: n.bookingId ? `/bookings/${n.bookingId}` : undefined,
      })
    ),
    ...c.bookings.flatMap((b) =>
      b.payments.map(
        (p): TimelineEvent => ({
          id: `payment-${p.id}`,
          date: p.createdAt,
          label: `Payment received: ${formatMoney(p.amount, p.currency)}`,
          kind: "payment",
          entityHref: `/bookings/${b.id}`,
        })
      )
    ),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 30);

  const statusMeta = CLIENT_STATUS_META[c.status as ClientStatus];
  const isCorporate = c.type === "corporate";
  const typeLabel = isCorporate ? "Corporate" : "Individual";

  // ---------------------------------------------------------------------------
  // Derived KPIs (real data only).
  //   - Lifetime value: Σ booking totalAmount, DZD-only (never mix currencies).
  //   - Trips booked: total booking count.
  //   - Last activity: most recent timeline event (relative), if any.
  // ---------------------------------------------------------------------------
  // DZD-only bookings back every money figure (never mix currencies).
  const dzdBookings = c.bookings.filter((b) => b.currency === "DZD");
  const lifetimeValueDzd = dzdBookings.reduce(
    (sum, b) => sum + Number(b.totalAmount ?? 0),
    0
  );
  const tripsBooked = c.bookings.length;
  const lastActivity = timelineEvents[0]?.date ?? null;

  // Open balance = Σ(total − paid) across DZD bookings, floored at 0 (never
  // shows a credit as a negative liability). Completed payments only.
  const openBalanceDzd = Math.max(
    0,
    dzdBookings.reduce((sum, b) => {
      const total = Number(b.totalAmount ?? 0);
      const paid = b.payments
        .filter((p) => p.currency === "DZD" && p.status === "completed")
        .reduce((s, p) => s + Number(p.amount ?? 0), 0);
      return sum + (total - paid);
    }, 0)
  );

  // Average booking value (DZD only) — derived, no fabrication.
  const avgBookingDzd =
    dzdBookings.length > 0 ? lifetimeValueDzd / dzdBookings.length : 0;

  // Spend over time — annual booked value (DZD only), last ~5 years.
  const spendByYear = new Map<number, number>();
  for (const b of dzdBookings) {
    const year = b.createdAt.getFullYear();
    spendByYear.set(year, (spendByYear.get(year) ?? 0) + Number(b.totalAmount ?? 0));
  }
  const spend = Array.from(spendByYear.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-5)
    .map(([year, value]) => ({ label: String(year), value }));
  // Micro-trend for the identity-rail sparkline (needs ≥2 points).
  const spendSpark = spend.map((s) => s.value);

  // Pre-shape serializable rows for the (client) tabs component.
  const tripRows: TripRow[] = c.bookings.map((b) => {
    const meta = BOOKING_STATUS_META[b.status as BookingStatus];
    const dates =
      b.departDate || b.returnDate
        ? `${formatDate(b.departDate)} – ${formatDate(b.returnDate)}`
        : "—";
    return {
      id: b.id,
      reference: b.reference,
      destination: b.destination ?? "Trip",
      flag: flagFor(b.destination),
      dates,
      amount: formatMoney(b.totalAmount, b.currency),
      statusLabel: meta?.label ?? b.status,
      statusTone: meta?.badgeClass,
    };
  });

  const opportunityRows: DealRow[] = opportunities.map((o) => {
    const meta = OPPORTUNITY_STAGE_META[o.stage as OpportunityStage];
    return {
      id: o.id,
      href: `/opportunities/${o.id}`,
      title: o.title,
      amount: formatMoney(o.value, o.currency),
      statusLabel: meta?.label ?? o.stage,
      statusTone: meta?.badgeClass,
    };
  });

  const proposalRows: DealRow[] = proposals.map((pr) => {
    const meta = PRODUCT_STATUS_META[pr.status as ProductStatus];
    return {
      id: pr.id,
      href: `/proposals/${pr.id}`,
      title: pr.title,
      reference: pr.reference,
      amount: formatMoney(pr.totalPrice, pr.currency),
      statusLabel: meta?.label ?? pr.status,
      statusTone: meta?.badgeClass,
    };
  });

  const location = [c.city, c.country].filter(Boolean).join(", ");
  const sourceLabel = c.source
    ? LEAD_SOURCE_LABEL[c.source as LeadSource] ?? c.source
    : null;

  const openBalanceZero = openBalanceDzd <= 0;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      {/* Breadcrumb + header actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/clients">{t("title")}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{typeLabel}</BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{c.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/clients/${c.id}/edit`}>
              <Pencil className="mr-1.5 size-4" />
              {t("editClient")}
            </Link>
          </Button>
          <DeleteClientButton id={c.id} name={c.name} />
        </div>
      </div>

      {/* ===== 3-column cockpit: identity rail · tabs · action rail ===== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_264px]">
        {/* ---------- LEFT: identity rail ---------- */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card className="card-elevated overflow-hidden">
            {/* Identity hero */}
            <div className="bg-accent/40 flex flex-col items-center border-b px-5 py-6 text-center">
              <ClientAvatar name={c.name} className="size-20 text-2xl" />
              <h1 className="mt-3 text-xl font-bold tracking-tight">{c.name}</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {isCorporate ? "Corporate" : "Individual traveller"} ·{" "}
                {t("profile.clientSince")} {c.createdAt.getFullYear()}
              </p>
              <div className="mt-2">
                <StatusBadge
                  label={statusMeta?.label ?? c.status}
                  tone={statusMeta?.badgeClass}
                />
              </div>
              {location && (
                <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-sm">
                  <MapPin className="size-3.5" />
                  {location}
                </p>
              )}
            </div>

            {/* 2×2 derived stat grid (real data only) */}
            <dl className="grid grid-cols-2 border-b">
              <div className="border-r border-b p-4">
                <dd className="text-lg font-bold tracking-tight tabular-nums">
                  {formatMoneyCompact(lifetimeValueDzd, "DZD")}
                </dd>
                <dt className="text-muted-foreground mt-0.5 text-xs">
                  {t("profile.lifetimeValue")}
                </dt>
              </div>
              <div className="border-b p-4">
                <dd className="text-lg font-bold tracking-tight tabular-nums">
                  {tripsBooked}
                </dd>
                <dt className="text-muted-foreground mt-0.5 text-xs">
                  {t("profile.tripsBooked")}
                </dt>
              </div>
              <div className="border-r p-4">
                <dd
                  className={cn(
                    "text-lg font-bold tracking-tight tabular-nums",
                    openBalanceZero
                      ? "text-green-600 dark:text-green-400"
                      : "text-amber-600 dark:text-amber-400"
                  )}
                >
                  {formatMoneyCompact(openBalanceDzd, "DZD")}
                </dd>
                <dt className="text-muted-foreground mt-0.5 text-xs">
                  {t("profile.openBalance")}
                </dt>
              </div>
              <div className="p-4">
                <dd className="text-lg font-bold tracking-tight tabular-nums">
                  {lastActivity ? formatRelative(lastActivity) : "—"}
                </dd>
                <dt className="text-muted-foreground mt-0.5 text-xs">
                  {t("profile.lastActivity")}
                </dt>
              </div>
            </dl>

            {/* Contact section */}
            {(c.email || c.phone || c.company || c.city || c.country) && (
              <div className="space-y-2.5 border-b px-5 py-4 text-sm">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  {t("profile.contact")}
                </p>
                {c.email && (
                  <a
                    href={`mailto:${c.email}`}
                    className="flex items-center gap-2.5 hover:underline"
                  >
                    <Mail className="text-muted-foreground size-4 shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </a>
                )}
                {c.phone && (
                  <a
                    href={`tel:${c.phone}`}
                    className="flex items-center gap-2.5 hover:underline"
                  >
                    <Phone className="text-muted-foreground size-4 shrink-0" />
                    {c.phone}
                  </a>
                )}
                {c.company && (
                  <p className="flex items-center gap-2.5">
                    <Building2 className="text-muted-foreground size-4 shrink-0" />
                    {c.company}
                  </p>
                )}
                {(c.city || c.country || c.address) && (
                  <p className="flex items-start gap-2.5">
                    <Globe className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                    <span>
                      {[c.address, c.city, c.country]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* Meta (owner / source / added) */}
            <dl className="text-muted-foreground space-y-2 px-5 py-4 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-1.5">
                  <UserIcon className="size-3.5" />
                  {t("profile.accountOwner")}
                </dt>
                <dd className="text-foreground font-medium">
                  {c.owner?.name ?? t("list.unassigned")}
                </dd>
              </div>
              {sourceLabel && (
                <div className="flex items-center justify-between gap-2">
                  <dt>Source</dt>
                  <dd className="text-foreground font-medium">{sourceLabel}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <dt>Added</dt>
                <dd className="text-foreground font-medium tabular-nums">
                  {formatDate(c.createdAt)}
                </dd>
              </div>
            </dl>
          </Card>
        </div>

        {/* ---------- CENTER: tabs ---------- */}
        <div className="min-w-0">
          <ClientProfileTabs
            clientId={c.id}
            trips={tripRows}
            lifetimeValue={formatMoney(lifetimeValueDzd, "DZD")}
            avgPerTrip={
              avgBookingDzd > 0
                ? formatMoneyCompact(avgBookingDzd, "DZD")
                : null
            }
            opportunities={opportunityRows}
            proposals={proposalRows}
            contacts={c.contacts}
            notes={c.notes}
            spend={spend}
            timelineEvents={timelineEvents}
          />
        </div>

        {/* ---------- RIGHT: action rail ---------- */}
        <div className="space-y-5 xl:sticky xl:top-20 xl:self-start">
          {/* Quick actions */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-base">
                {t("profile.quickActions")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild size="sm" className="w-full justify-start">
                <Link href={`/bookings/new?clientId=${c.id}`}>
                  <Plus className="mr-2 size-4" />
                  {t("profile.startBooking")}
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full justify-start"
              >
                <Link href={`/proposals/new?clientId=${c.id}`}>
                  <FileText className="mr-2 size-4" />
                  {t("profile.buildProposal")}
                </Link>
              </Button>
              {c.email && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                >
                  <a href={`mailto:${c.email}`}>
                    <Mail className="mr-2 size-4" />
                    {t("profile.sendEmail")}
                  </a>
                </Button>
              )}
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full justify-start"
              >
                <Link href={`/clients/${c.id}/edit`}>
                  <StickyNote className="mr-2 size-4" />
                  {t("profile.logNote")}
                </Link>
              </Button>
              <PortalInviteButton
                clientId={c.id}
                clientEmail={c.email}
                variant="ghost"
                fullWidth
                label={t("profile.sharePortal")}
              />
            </CardContent>
          </Card>

          {/* Account owner */}
          {c.owner && (
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-base">
                  {t("profile.accountOwner")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <ClientAvatar name={c.owner.name} className="size-10 text-sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.owner.name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      Agent
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Financial snapshot — derived, DZD only */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-base">
                {t("profile.financialSnapshot")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {t("profile.lifetimeValue")}
                </span>
                <span className="font-medium tabular-nums">
                  {formatMoney(lifetimeValueDzd, "DZD")}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {t("profile.outstanding")}
                </span>
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    openBalanceZero
                      ? "text-green-600 dark:text-green-400"
                      : "text-amber-600 dark:text-amber-400"
                  )}
                >
                  {formatMoney(openBalanceDzd, "DZD")}
                </span>
              </div>
              {avgBookingDzd > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {t("profile.avgBooking")}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatMoney(avgBookingDzd, "DZD")}
                  </span>
                </div>
              )}
              {spendSpark.length >= 2 && (
                <div className="flex items-center justify-between gap-2 border-t pt-2.5">
                  <span className="text-muted-foreground">
                    {t("profile.spendOverTime")}
                  </span>
                  <SparkLine data={spendSpark} color="var(--brand)" />
                </div>
              )}
            </CardContent>
          </Card>

          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/clients">
              <ChevronLeft className="mr-1 size-4" />
              {t("profile.backToClients")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
