import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { Compass, MapPin, CalendarDays } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { db } from "@/lib/db";
import { BOOKING_ITEM_TYPE_META, type BookingItemType } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { buildItinerary } from "@/lib/itinerary";
import { booking } from "@/lib/schema";

export const metadata = { title: "Your itinerary", robots: { index: false } };

export default async function PublicItinerary({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations("public.itinerary");

  const b = await db.query.booking.findFirst({
    where: eq(booking.shareToken, token),
    with: {
      client: { columns: { name: true } },
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

  const allDays = [
    ...days,
    ...(unscheduled.length
      ? [{ dayIndex: -1, date: null, title: t("otherServices"), notes: null, items: unscheduled }]
      : []),
  ];

  return (
    <div className="bg-muted/30 min-h-screen py-10">
      <div className="mx-auto max-w-2xl px-4">
        {/* Brand header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="bg-primary/10 flex size-11 items-center justify-center rounded-lg">
            <Compass className="text-primary size-6" />
          </div>
          <div>
            <p className="text-lg font-bold">{APP_NAME}</p>
            <p className="text-muted-foreground text-sm">{APP_TAGLINE}</p>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold">
            {b.destination ? t("yourTrip", { destination: b.destination }) : t("title")}
          </h1>
          <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {b.client?.name && <span>{b.client.name}</span>}
            {(b.departDate || b.returnDate) && (
              <span className="flex items-center gap-1">
                <CalendarDays className="size-4" />
                {formatDate(b.departDate)} → {formatDate(b.returnDate)}
              </span>
            )}
          </div>

          <div className="mt-6 space-y-6">
            {allDays.map((day) => (
              <div key={day.dayIndex} className="relative border-l-2 pl-5">
                <span className="bg-primary absolute top-1 -left-[7px] size-3 rounded-full" />
                <p className="text-sm font-semibold">
                  {day.dayIndex >= 0 ? `${t("day")} ${day.dayIndex + 1}` : day.title}
                  {day.date && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {formatDate(day.date)}
                    </span>
                  )}
                </p>
                {day.dayIndex >= 0 && day.title && (
                  <p className="text-sm font-medium">{day.title}</p>
                )}
                {day.notes && (
                  <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">
                    {day.notes}
                  </p>
                )}
                {day.items.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {day.items.map((i) => (
                      <li key={i.id} className="rounded-md border p-3">
                        <p className="text-sm font-medium">{i.title}</p>
                        <p className="text-muted-foreground flex items-center gap-1 text-xs">
                          <MapPin className="size-3" />
                          {BOOKING_ITEM_TYPE_META[i.type as BookingItemType]?.label ?? i.type}
                          {i.supplier ? ` · ${i.supplier}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                {day.items.length === 0 && day.dayIndex >= 0 && !day.notes && (
                  <p className="text-muted-foreground mt-1 text-sm">Free day.</p>
                )}
              </div>
            ))}
          </div>

          <p className="text-muted-foreground mt-8 border-t pt-5 text-xs">
            Prepared by {APP_NAME}. Times and services are subject to final confirmation.
          </p>
        </div>
      </div>
    </div>
  );
}
