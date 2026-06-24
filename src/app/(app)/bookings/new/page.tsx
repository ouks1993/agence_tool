import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { BookingForm } from "@/components/bookings/booking-form";
import { Button } from "@/components/ui/button";
import { requireAgencyUser } from "@/lib/permissions";
import { listClientOptions } from "@/lib/queries";

export const metadata = { title: "New booking" };

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const user = await requireAgencyUser();
  const sp = await searchParams;
  const clients = await listClientOptions(user.agencyId);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/bookings">
          <ArrowLeft className="mr-1 size-4" />
          Bookings
        </Link>
      </Button>
      <PageHeader
        title="New booking"
        description="Start the file — you'll add travellers, flights, hotels and extras next."
      />
      <BookingForm
        mode="create"
        clients={clients}
        initial={{ clientId: sp.clientId ?? "", currency: "EUR" }}
      />
    </div>
  );
}
