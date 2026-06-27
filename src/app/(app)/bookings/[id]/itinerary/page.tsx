import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { GenerateItineraryButton } from "@/components/bookings/generate-itinerary-button";
import {
  ItineraryBuilder,
  type DayVM,
  type ItemVM,
} from "@/components/bookings/itinerary-builder";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { BOOKING_ITEM_TYPE_META, type BookingItemType } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { buildItinerary } from "@/lib/itinerary";
import { requireAgencyUser } from "@/lib/permissions";
import { booking } from "@/lib/schema";

export const metadata = { title: "Itinerary" };

function itemMeta(i: {
  type: string;
  supplier: string | null;
  amount: string;
  currency: string;
  confirmationNumber: string | null;
}): string {
  return [
    BOOKING_ITEM_TYPE_META[i.type as BookingItemType]?.label ?? i.type,
    i.supplier,
    i.confirmationNumber,
    formatMoney(i.amount, i.currency),
  ]
    .filter(Boolean)
    .join(" · ");
}

export default async function ItineraryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAgencyUser();
  const { id } = await params;

  const b = await db.query.booking.findFirst({
    where: and(eq(booking.id, id), eq(booking.agencyId, user.agencyId)),
    with: {
      items: { orderBy: (t) => [asc(t.sortOrder)] },
      days: true,
    },
  });
  if (!b) notFound();

  const { days, unscheduled } = buildItinerary({
    departDate: b.departDate,
    returnDate: b.returnDate,
    items: b.items.map((i) => ({
      id: i.id,
      type: i.type,
      title: i.title,
      supplier: i.supplier,
      startDate: i.startDate,
      amount: i.amount,
      currency: i.currency,
      confirmationNumber: i.confirmationNumber,
      dayIndex: i.dayIndex,
    })),
    dayRows: b.days.map((d) => ({ dayIndex: d.dayIndex, title: d.title, notes: d.notes })),
  });

  const toItemVM = (i: (typeof days)[number]["items"][number]): ItemVM => ({
    id: i.id,
    type: i.type,
    title: i.title,
    meta: itemMeta(i),
  });

  const dayVMs: DayVM[] = days.map((d) => ({
    dayIndex: d.dayIndex,
    dateLabel: d.date ? formatDate(d.date) : "",
    title: d.title ?? "",
    notes: d.notes ?? "",
    items: d.items.map(toItemVM),
  }));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/bookings/${id}`}>
          <ArrowLeft className="mr-1 size-4" />
          Booking
        </Link>
      </Button>
      <PageHeader
        title="Itinerary"
        description={b.destination ? `${b.reference} · ${b.destination}` : b.reference}
      >
        <GenerateItineraryButton bookingId={b.id} />
      </PageHeader>
      <ItineraryBuilder
        bookingId={b.id}
        days={dayVMs}
        unscheduled={unscheduled.map(toItemVM)}
        shareToken={b.shareToken}
      />
    </div>
  );
}
