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
  Briefcase,
  CalendarClock,
  Wallet,
  User as UserIcon,
} from "lucide-react";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
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
import { formatDate, formatMoney, formatRelative } from "@/lib/format";
import { requireAgencyUser } from "@/lib/permissions";
import {
  activityLog,
  client,
  notification,
  opportunity,
  product,
} from "@/lib/schema";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAgencyUser();
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
  const lifetimeValueDzd = c.bookings
    .filter((b) => b.currency === "DZD")
    .reduce((sum, b) => sum + Number(b.totalAmount ?? 0), 0);
  const tripsBooked = c.bookings.length;
  const lastActivity = timelineEvents[0]?.date ?? null;

  // Spend over time — annual booked value (DZD only), last ~5 years.
  const spendByYear = new Map<number, number>();
  for (const b of c.bookings) {
    if (b.currency !== "DZD") continue;
    const year = b.createdAt.getFullYear();
    spendByYear.set(year, (spendByYear.get(year) ?? 0) + Number(b.totalAmount ?? 0));
  }
  const spend = Array.from(spendByYear.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-5)
    .map(([year, value]) => ({ label: String(year), value }));

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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/clients">Clients</Link>
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

      {/* Profile header */}
      <Card className="card-elevated">
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <ClientAvatar name={c.name} className="size-16 text-xl" />
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">{c.name}</h1>
                  <StatusBadge
                    label={statusMeta?.label ?? c.status}
                    tone={statusMeta?.badgeClass}
                  />
                </div>
                <p className="text-muted-foreground text-sm">
                  {isCorporate ? "Corporate" : "Individual traveller"} · Client
                  since {c.createdAt.getFullYear()}
                </p>
                {location && (
                  <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                    <MapPin className="size-3.5" />
                    {location}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/clients/${c.id}/edit`}>
                  <Pencil className="mr-1.5 size-4" />
                  Edit
                </Link>
              </Button>
              <PortalInviteButton clientId={c.id} clientEmail={c.email} />
              <Button asChild size="sm">
                <Link href={`/bookings/new?clientId=${c.id}`}>
                  <Plus className="mr-1.5 size-4" />
                  New trip
                </Link>
              </Button>
              <DeleteClientButton id={c.id} name={c.name} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat strip — real / derived only. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Lifetime value"
          value={formatMoney(lifetimeValueDzd, "DZD")}
          hint="Booked value (DZD)"
          icon={Wallet}
        />
        <StatCard
          label="Trips booked"
          value={tripsBooked}
          hint={tripsBooked === 1 ? "1 booking" : `${tripsBooked} bookings`}
          icon={Briefcase}
        />
        <StatCard
          label="Last activity"
          value={lastActivity ? formatRelative(lastActivity) : "—"}
          hint={lastActivity ? formatDate(lastActivity) : "No activity yet"}
          icon={CalendarClock}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column: tabs */}
        <div className="min-w-0 lg:col-span-2">
          <ClientProfileTabs
            clientId={c.id}
            trips={tripRows}
            opportunities={opportunityRows}
            proposals={proposalRows}
            contacts={c.contacts}
            notes={c.notes}
            spend={spend}
            timelineEvents={timelineEvents}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {c.email && (
                <p className="flex items-center gap-2.5">
                  <Mail className="text-muted-foreground size-4 shrink-0" />
                  <a
                    href={`mailto:${c.email}`}
                    className="truncate hover:underline"
                  >
                    {c.email}
                  </a>
                </p>
              )}
              {c.phone && (
                <p className="flex items-center gap-2.5">
                  <Phone className="text-muted-foreground size-4 shrink-0" />
                  {c.phone}
                </p>
              )}
              {c.company && (
                <p className="flex items-center gap-2.5">
                  <Building2 className="text-muted-foreground size-4 shrink-0" />
                  {c.company}
                </p>
              )}
              {(c.city || c.country || c.address) && (
                <p className="flex items-start gap-2.5">
                  <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <span>
                    {[c.address, c.city, c.country].filter(Boolean).join(", ")}
                  </span>
                </p>
              )}
              <dl className="text-muted-foreground space-y-2 border-t pt-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-1.5">
                    <UserIcon className="size-3.5" />
                    Owner
                  </dt>
                  <dd className="text-foreground font-medium">
                    {c.owner?.name ?? "Unassigned"}
                  </dd>
                </div>
                {sourceLabel && (
                  <div className="flex items-center justify-between gap-2">
                    <dt>Source</dt>
                    <dd className="text-foreground font-medium">
                      {sourceLabel}
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <dt>Added</dt>
                  <dd className="text-foreground font-medium tabular-nums">
                    {formatDate(c.createdAt)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {c.notes && (
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 whitespace-pre-wrap">
                  {c.notes}
                </p>
              </CardContent>
            </Card>
          )}

          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/clients">
              <ChevronLeft className="mr-1 size-4" />
              Back to clients
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
