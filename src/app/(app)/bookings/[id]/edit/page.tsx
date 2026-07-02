import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { BookingForm } from "@/components/bookings/booking-form";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { toDateInputValue } from "@/lib/format";
import { effectiveDepositPercent } from "@/lib/payments/deposit";
import { requireAgencyUser } from "@/lib/permissions";
import { listClientOptions } from "@/lib/queries";
import { agency, booking } from "@/lib/schema";

export const metadata = { title: "Edit booking" };

export default async function EditBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAgencyUser();
  const { id } = await params;
  const [b, clients, ag] = await Promise.all([
    db.query.booking.findFirst({
      where: and(eq(booking.id, id), eq(booking.agencyId, user.agencyId)),
    }),
    listClientOptions(user.agencyId),
    db.query.agency.findFirst({
      where: eq(agency.id, user.agencyId),
      columns: { depositPercent: true },
    }),
  ]);
  if (!b) notFound();
  // Placeholder shown when the override is left empty = the agency default.
  const agencyDepositPercent = effectiveDepositPercent(null, ag?.depositPercent);

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
        agencyDepositPercent={agencyDepositPercent}
        initial={{
          clientId: b.clientId ?? "",
          destination: b.destination ?? "",
          departDate: toDateInputValue(b.departDate),
          returnDate: toDateInputValue(b.returnDate),
          travelPurpose: b.travelPurpose ?? "",
          tripType: b.tripType ?? "",
          currency: b.currency,
          // Empty string = inherit; a snapshotted override pre-fills the field.
          depositPercent: b.depositPercent ?? "",
          notes: b.notes ?? "",
        }}
      />
    </div>
  );
}
