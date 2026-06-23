import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { BookingForm } from "@/components/bookings/booking-form";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { toDateInputValue } from "@/lib/format";
import { requireUser } from "@/lib/permissions";
import { listClientOptions } from "@/lib/queries";
import { booking } from "@/lib/schema";

export const metadata = { title: "Edit booking" };

export default async function EditBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const [b, clients] = await Promise.all([
    db.query.booking.findFirst({ where: eq(booking.id, id) }),
    listClientOptions(),
  ]);
  if (!b) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/bookings/${id}`}>
          <ArrowLeft className="mr-1 size-4" />
          {b.reference}
        </Link>
      </Button>
      <PageHeader title="Edit trip details" />
      <BookingForm
        mode="edit"
        bookingId={id}
        clients={clients}
        initial={{
          clientId: b.clientId ?? "",
          destination: b.destination ?? "",
          departDate: toDateInputValue(b.departDate),
          returnDate: toDateInputValue(b.returnDate),
          currency: b.currency,
          notes: b.notes ?? "",
        }}
      />
    </div>
  );
}
