import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  Pencil,
  MapPin,
  Calendar,
  Users,
  ShieldAlert,
  Wallet,
  FileText,
  Receipt,
  Mail,
  BadgePercent,
  Map as MapIcon,
  Search,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { AssignedAgentCard } from "@/components/bookings/assigned-agent-card";
import { BookingActivity } from "@/components/bookings/booking-activity";
import { BookingDocuments } from "@/components/bookings/booking-documents";
import { BookingItemsManager } from "@/components/bookings/booking-items-manager";
import { BookingLifecycleStepper } from "@/components/bookings/booking-lifecycle-stepper";
import { BookingNotesCard } from "@/components/bookings/booking-notes-card";
import { BookingStatusControl } from "@/components/bookings/booking-status-control";
import { CommunicationsManager } from "@/components/bookings/communications-manager";
import { DeleteBookingButton } from "@/components/bookings/delete-booking-button";
import { PaymentsManager } from "@/components/bookings/payments-manager";
import { PaymentSummaryCard } from "@/components/bookings/payment-summary-card";
import { SearchSheet } from "@/components/bookings/search-sheet";
import { SupplierRefsCard } from "@/components/bookings/supplier-refs-card";
import { TravellersManager } from "@/components/bookings/travellers-manager";
import { VisaAssistant } from "@/components/bookings/visa-assistant";
import { PortalInviteButton } from "@/components/clients/portal-invite-button";
import { CommissionsManager } from "@/components/commissions/commissions-manager";
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
import { getCommissionsByBooking } from "@/lib/actions/commissions";
import { getSuppliersForPicker } from "@/lib/actions/suppliers";
import { db } from "@/lib/db";
import {
  BOOKING_STATUS_META,
  canViewFinance,
  seesAllData,
  type BookingStatus,
} from "@/lib/domain";
import { formatDate, passportExpiryStatus } from "@/lib/format";
import { isEmailConfigured } from "@/lib/notifications/email";
import { isStripeConfigured } from "@/lib/payments/stripe";
import { paymentSummary } from "@/lib/payments/summary";
import { requireAgencyUser } from "@/lib/permissions";
import { listClientOptions, listOpenBookings } from "@/lib/queries";
import { booking } from "@/lib/schema";
import {
  getActiveFlightProvider,
  getActiveHotelProvider,
} from "@/lib/travel-platform";

export default async function BookingWorkspace({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAgencyUser();
  const t = await getTranslations("bookings");
  const { id } = await params;

  // bookings + clients power the embedded flight/hotel search sheet, mirroring
  // what the standalone /search page fetches for SearchWorkspace.
  const [b, suppliers, searchClients, searchBookings] = await Promise.all([
    db.query.booking.findFirst({
      // Agents may only open bookings they created (others see all).
      where: and(
        eq(booking.id, id),
        eq(booking.agencyId, user.agencyId),
        seesAllData(user.role) ? undefined : eq(booking.createdById, user.id)
      ),
      with: {
        client: { columns: { id: true, name: true, email: true } },
        // Assigned-agent panel: created-by identity (real, nullable FK).
        createdBy: { columns: { name: true, email: true, image: true } },
        travellers: { orderBy: (t) => [asc(t.sortOrder)] },
        items: { orderBy: (t) => [asc(t.sortOrder)] },
        payments: { orderBy: (t) => [desc(t.createdAt)] },
        notifications: { orderBy: (t) => [desc(t.createdAt)] },
        // Sprint-1 lifecycle tables — power the supplier-refs, documents and
        // activity panels. All optional: each panel omits itself when empty.
        supplierRefs: { orderBy: (t) => [asc(t.createdAt)] },
        documents: { orderBy: (t) => [desc(t.createdAt)] },
        events: { orderBy: (t) => [desc(t.createdAt)], limit: 12 },
      },
    }),
    getSuppliersForPicker(),
    listClientOptions(user.agencyId),
    listOpenBookings(user.agencyId),
  ]);
  if (!b) notFound();

  const flightLabel = getActiveFlightProvider().label;
  const hotelLabel = getActiveHotelProvider().label;
  const supplierLabel =
    flightLabel === hotelLabel ? flightLabel : `${flightLabel} · ${hotelLabel}`;

  // Commissions are part of the finance workspace; only fetch them for roles
  // that can view finance so we never do the extra query for everyone else.
  const showCommissions = canViewFinance(user.role);
  const commissions = showCommissions
    ? await getCommissionsByBooking(b.id)
    : [];

  const meta = BOOKING_STATUS_META[b.status as BookingStatus];
  const travelDate = b.departDate;
  const total = parseFloat(b.totalAmount || "0");
  const { paid, balance } = paymentSummary(b.payments, total);

  // Passport expiry warnings across travellers.
  const passportIssues = b.travellers
    .map((t) => ({ t, status: passportExpiryStatus(t.passportExpiry, travelDate) }))
    .filter((x) => x.status.level === "warning" || x.status.level === "expired");

  // Presentational derivations from already-loaded data (no new queries):
  // paidPct drives the payment progress bar; clamped 0-100.
  const paidPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  // nights drives an optional Nights detail row — omitted when either date is absent.
  const nights =
    b.departDate && b.returnDate
      ? Math.max(
          0,
          Math.round(
            (b.returnDate.getTime() - b.departDate.getTime()) / 86_400_000
          )
        )
      : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/bookings">Bookings</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{b.reference}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* ===== Hero header: ref + status badges + actions ===== */}
      <PageHeader title={b.reference}>
        <BookingStatusControl
          id={b.id}
          status={b.status}
          hasItems={b.items.length > 0}
          hasBalance={balance > 0}
        />
        <Button asChild variant="outline" size="sm">
          <Link href={`/bookings/${b.id}/itinerary`}>
            <MapIcon className="mr-2 size-4" />
            Itinerary
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/booking-docs/${b.id}/voucher`} target="_blank">
            <FileText className="mr-2 size-4" />
            Voucher
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/booking-docs/${b.id}/invoice`} target="_blank">
            <Receipt className="mr-2 size-4" />
            Invoice
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/bookings/${b.id}/edit`}>
            <Pencil className="mr-2 size-4" />
            Edit trip
          </Link>
        </Button>
        {b.client && (
          <PortalInviteButton
            clientId={b.client.id}
            clientEmail={b.client.email ?? null}
          />
        )}
        <DeleteBookingButton id={b.id} label={b.reference} />
      </PageHeader>

      {/* Sub-line: status + client + trip facts (real columns only). */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
        <StatusBadge label={meta?.label ?? b.status} tone={meta?.badgeClass} />
        {b.client && (
          <Link
            href={`/clients/${b.client.id}`}
            className="font-medium hover:underline"
          >
            {b.client.name}
          </Link>
        )}
        {b.destination && (
          <>
            <span className="text-muted-foreground/40" aria-hidden>
              ·
            </span>
            <span className="text-muted-foreground inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {b.destination}
            </span>
          </>
        )}
        {(b.departDate || b.returnDate) && (
          <>
            <span className="text-muted-foreground/40" aria-hidden>
              ·
            </span>
            <span className="text-muted-foreground inline-flex items-center gap-1">
              <Calendar className="size-3.5" />
              {formatDate(b.departDate)} → {formatDate(b.returnDate)}
              {nights !== null && ` · ${nights} nights`}
            </span>
          </>
        )}
        {b.travellers.length > 0 && (
          <>
            <span className="text-muted-foreground/40" aria-hidden>
              ·
            </span>
            <span className="text-muted-foreground inline-flex items-center gap-1">
              <Users className="size-3.5" />
              {b.travellers.length} travellers
            </span>
          </>
        )}
      </div>

      {/* ===== Lifecycle stepper (preserved control) ===== */}
      <BookingLifecycleStepper
        bookingId={b.id}
        status={b.status}
        hasItems={b.items.length > 0}
        hasBalance={balance > 0}
      />

      {passportIssues.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Passport attention needed</p>
            <ul className="mt-1 list-disc pl-4">
              {passportIssues.map(({ t, status }) => (
                <li key={t.id}>
                  {t.fullName}: {status.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ===== Two-column: main workspace + compact right rail ===== */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" /> {t("travellersTitle")}
                {b.travellers.length === 0 && (
                  <span className="ml-auto text-xs font-normal text-amber-600 dark:text-amber-400">
                    Add travellers first
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TravellersManager
                bookingId={b.id}
                travelDate={travelDate}
                travellers={b.travellers.map((t) => ({
                  id: t.id,
                  fullName: t.fullName,
                  title: t.title,
                  gender: t.gender,
                  passportNumber: t.passportNumber,
                  passportExpiry: t.passportExpiry,
                  nationality: t.nationality,
                  dateOfBirth: t.dateOfBirth,
                  passportIssueDate: t.passportIssueDate,
                  passportIssuePlace: t.passportIssuePlace,
                  isLead: t.isLead,
                }))}
              />
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {t("purchasesTitle")}
                <div className="ml-auto flex items-center gap-2">
                  {b.items.length === 0 && (
                    <span className="text-xs font-normal text-muted-foreground">
                      No trip services yet
                    </span>
                  )}
                  <SearchSheet
                    bookingId={b.id}
                    bookingRef={b.reference}
                    destination={b.destination}
                    bookings={searchBookings}
                    clients={searchClients}
                    supplierLabel={supplierLabel}
                    trigger={
                      <Button variant="outline" size="sm">
                        <Search className="mr-2 size-4" />
                        Search flights/hotels
                      </Button>
                    }
                  />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BookingItemsManager
                bookingId={b.id}
                currency={b.currency}
                suppliers={suppliers}
                items={b.items.map((i) => ({
                  id: i.id,
                  type: i.type,
                  title: i.title,
                  description: i.description,
                  supplier: i.supplier,
                  bookingRef: i.bookingRef,
                  startDate: i.startDate,
                  endDate: i.endDate,
                  quantity: i.quantity,
                  amount: i.amount,
                  currency: i.currency,
                  itemStatus: i.itemStatus,
                  confirmationNumber: i.confirmationNumber,
                }))}
              />
            </CardContent>
          </Card>

          <BookingDocuments
            documents={b.documents.map((d) => ({
              id: d.id,
              type: d.type,
              providerId: d.providerId,
              url: d.url,
              generatedAt: d.generatedAt,
              createdAt: d.createdAt,
            }))}
          />

          <BookingActivity
            events={b.events.map((e) => ({
              id: e.id,
              event: e.event,
              providerId: e.providerId,
              createdAt: e.createdAt,
            }))}
          />

          <Card id="payments" className="card-elevated scroll-mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="size-4" /> Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentsManager
                bookingId={b.id}
                currency={b.currency}
                balance={balance}
                stripeConfigured={isStripeConfigured()}
                payments={b.payments.map((p) => ({
                  id: p.id,
                  amount: p.amount,
                  currency: p.currency,
                  kind: p.kind,
                  method: p.method,
                  status: p.status,
                  reference: p.reference,
                  note: p.note,
                  createdAt: p.createdAt,
                }))}
              />
            </CardContent>
          </Card>

          {showCommissions && (
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BadgePercent className="size-4" /> Commissions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CommissionsManager commissions={commissions} bookingId={b.id} />
              </CardContent>
            </Card>
          )}

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="size-4" /> Messages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CommunicationsManager
                bookingId={b.id}
                clientEmail={b.client?.email ?? null}
                emailConfigured={isEmailConfigured()}
                notifications={b.notifications.map((n) => ({
                  id: n.id,
                  channel: n.channel,
                  recipient: n.recipient,
                  subject: n.subject,
                  kind: n.kind,
                  status: n.status,
                  createdAt: n.createdAt,
                }))}
              />
            </CardContent>
          </Card>
        </div>

        {/* ===== Right rail ===== */}
        <div className="space-y-6">
          <PaymentSummaryCard
            currency={b.currency}
            total={total}
            paid={paid}
            balance={balance}
            paidPct={paidPct}
            balanceDueDate={b.departDate}
          />

          <SupplierRefsCard
            refs={b.supplierRefs.map((r) => ({
              id: r.id,
              providerId: r.providerId,
              confirmationNumber: r.confirmationNumber,
              pnr: r.pnr,
              supplierOrderId: r.supplierOrderId,
            }))}
          />

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-base">Trip details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail icon={MapPin} label="Destination" value={b.destination ?? "—"} />
              <Detail
                icon={Calendar}
                label="Travel dates"
                value={
                  b.departDate || b.returnDate
                    ? `${formatDate(b.departDate)} → ${formatDate(b.returnDate)}`
                    : "—"
                }
              />
              {nights !== null && (
                <Detail icon={Calendar} label="Nights" value={String(nights)} />
              )}
              <Detail icon={Users} label="Travellers" value={String(b.travellers.length)} />
            </CardContent>
          </Card>

          <AssignedAgentCard
            agent={b.createdBy ?? null}
            createdAt={b.createdAt}
            updatedAt={b.updatedAt}
          />

          <VisaAssistant bookingId={b.id} />

          <BookingNotesCard
            notes={b.notes}
            currency={b.currency}
            balance={balance}
            departDate={b.departDate}
          />
        </div>
      </div>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p>{value}</p>
      </div>
    </div>
  );
}
