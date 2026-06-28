import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  ArrowLeft,
  Pencil,
  MapPin,
  Calendar,
  Users,
  ShieldAlert,
  StickyNote,
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
import { BookingItemsManager } from "@/components/bookings/booking-items-manager";
import { BookingLifecycleStepper } from "@/components/bookings/booking-lifecycle-stepper";
import { BookingStatusControl } from "@/components/bookings/booking-status-control";
import { CommunicationsManager } from "@/components/bookings/communications-manager";
import { DeleteBookingButton } from "@/components/bookings/delete-booking-button";
import { PaymentsManager } from "@/components/bookings/payments-manager";
import { SearchSheet } from "@/components/bookings/search-sheet";
import { TravellersManager } from "@/components/bookings/travellers-manager";
import { VisaAssistant } from "@/components/bookings/visa-assistant";
import { PortalInviteButton } from "@/components/clients/portal-invite-button";
import { CommissionsManager } from "@/components/commissions/commissions-manager";
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
import { formatDate, formatMoney, passportExpiryStatus } from "@/lib/format";
import { isEmailConfigured } from "@/lib/notifications/email";
import { isStripeConfigured } from "@/lib/payments/stripe";
import { paymentSummary } from "@/lib/payments/summary";
import { requireAgencyUser } from "@/lib/permissions";
import { listClientOptions, listOpenBookings } from "@/lib/queries";
import { booking } from "@/lib/schema";
import { getFlightSupplier, getHotelSupplier } from "@/lib/suppliers";

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
        travellers: { orderBy: (t) => [asc(t.sortOrder)] },
        items: { orderBy: (t) => [asc(t.sortOrder)] },
        payments: { orderBy: (t) => [desc(t.createdAt)] },
        notifications: { orderBy: (t) => [desc(t.createdAt)] },
      },
    }),
    getSuppliersForPicker(),
    listClientOptions(user.agencyId),
    listOpenBookings(user.agencyId),
  ]);
  if (!b) notFound();

  const flightLabel = getFlightSupplier().label;
  const hotelLabel = getHotelSupplier().label;
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/bookings">
          <ArrowLeft className="mr-1 size-4" />
          Bookings
        </Link>
      </Button>

      <PageHeader title={b.client?.name ?? b.destination ?? "Booking"} description={b.reference}>
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

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={meta?.label ?? b.status} tone={meta?.badgeClass} />
        {b.client && (
          <Link href={`/clients/${b.client.id}`} className="text-muted-foreground text-sm hover:underline">
            {b.client.name}
          </Link>
        )}
      </div>

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
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

          <Card>
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

          <Card>
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
            <Card>
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

          <Card>
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

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="size-4" /> Finance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total</span>
                <span>{formatMoney(total, b.currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="text-green-600 dark:text-green-400">
                  {formatMoney(paid, b.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="font-semibold">Balance due</span>
                <span
                  className={
                    balance > 0
                      ? "text-lg font-bold text-amber-600 dark:text-amber-400"
                      : "text-lg font-bold text-green-600 dark:text-green-400"
                  }
                >
                  {formatMoney(balance, b.currency)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
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
              <Detail icon={Users} label="Travellers" value={String(b.travellers.length)} />
            </CardContent>
          </Card>

          <VisaAssistant bookingId={b.id} />

          {b.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <StickyNote className="size-4" /> Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{b.notes}</p>
              </CardContent>
            </Card>
          )}
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
