import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Plus, Briefcase, CalendarClock, Wallet, CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { BookingsBoard } from "@/components/bookings/bookings-board";
import { BookingsTable } from "@/components/bookings/bookings-table";
import { BookingsViewToggle } from "@/components/bookings/view-toggle";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { seesAllData } from "@/lib/domain";
import { requireAgencyUser } from "@/lib/permissions";
import { booking, bookingTraveller } from "@/lib/schema";

export const metadata = { title: "Bookings" };

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireAgencyUser();
  const t = await getTranslations("bookings");
  const { view: viewParam } = await searchParams;
  const view = viewParam === "board" ? "board" : "list";

  const bookings = await db.query.booking.findMany({
    // Agents see only bookings they created (admin/manager/finance/support see all).
    where: and(
      eq(booking.agencyId, user.agencyId),
      seesAllData(user.role) ? undefined : eq(booking.createdById, user.id)
    ),
    with: { client: { columns: { name: true } } },
    orderBy: [desc(booking.createdAt)],
    limit: 200,
  });

  // Traveller counts are scoped to this agency's bookings only (children have no agencyId).
  const bookingIds = bookings.map((b) => b.id);
  const counts =
    bookingIds.length > 0
      ? await db
          .select({
            bookingId: bookingTraveller.bookingId,
            count: sql<number>`count(*)::int`,
          })
          .from(bookingTraveller)
          .where(inArray(bookingTraveller.bookingId, bookingIds))
          .groupBy(bookingTraveller.bookingId)
      : [];
  const countMap = new Map(counts.map((c) => [c.bookingId, c.count]));

  // Derived KPIs — counts only (never sum across currencies, per the no-FX rule).
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const kpi = {
    total: bookings.length,
    upcoming: bookings.filter((b) => b.departDate && new Date(b.departDate) >= today).length,
    awaiting: bookings.filter((b) => b.status === "awaiting_payment").length,
    completed: bookings.filter((b) => b.status === "completed").length,
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader title={t("title")} description={t("description")}>
        <BookingsViewToggle view={view} />
        <Button asChild>
          <Link href="/bookings/new">
            <Plus className="mr-2 size-4" />
            {t("newBooking")}
          </Link>
        </Button>
      </PageHeader>

      {bookings.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total bookings" value={kpi.total} icon={Briefcase} />
          <StatCard label="Upcoming departures" value={kpi.upcoming} icon={CalendarClock} />
          <StatCard label="Awaiting payment" value={kpi.awaiting} icon={Wallet} />
          <StatCard label="Completed" value={kpi.completed} icon={CheckCircle2} />
        </div>
      )}

      {bookings.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={t("noBookings")}
          description="Create a booking, add the travellers' passport details, then add their flights, hotels and extras."
          action={
            <Button asChild>
              <Link href="/bookings/new">
                <Plus className="mr-2 size-4" />
                {t("newBooking")}
              </Link>
            </Button>
          }
        />
      ) : view === "board" ? (
        <BookingsBoard
          bookings={bookings.map((b) => ({
            id: b.id,
            reference: b.reference,
            status: b.status,
            destination: b.destination,
            departDate: b.departDate,
            totalAmount: b.totalAmount,
            currency: b.currency,
            clientName: b.client?.name ?? null,
          }))}
        />
      ) : (
        <BookingsTable
          labels={{
            reference: t("table.reference"),
            client: t("table.client"),
            destination: t("table.destination"),
            dates: t("table.dates"),
            status: t("table.status"),
            total: t("table.total"),
          }}
          rows={bookings.map((b) => ({
            id: b.id,
            reference: b.reference,
            clientName: b.client?.name ?? null,
            destination: b.destination,
            departDate: b.departDate,
            returnDate: b.returnDate,
            pax: countMap.get(b.id) ?? 0,
            status: b.status,
            totalAmount: b.totalAmount,
            currency: b.currency,
          }))}
        />
      )}
    </div>
  );
}
