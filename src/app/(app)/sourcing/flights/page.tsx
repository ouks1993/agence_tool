import { Info } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { SearchWorkspace } from "@/components/search/search-workspace";
import { requireAgencyUser } from "@/lib/permissions";
import { listClientOptions, listOpenBookings } from "@/lib/queries";
import {
  getFlightSupplier,
  getHotelSupplier,
  isLiveSupplierConfigured,
} from "@/lib/suppliers";

export const metadata = { title: "Flights" };

export default async function FlightsSourcingPage() {
  const user = await requireAgencyUser();
  const [clients, bookings] = await Promise.all([
    listClientOptions(user.agencyId),
    listOpenBookings(user.agencyId),
  ]);
  const live = isLiveSupplierConfigured();
  const flightLabel = getFlightSupplier().label;
  const hotelLabel = getHotelSupplier().label;
  const supplierLabel =
    flightLabel === hotelLabel
      ? flightLabel
      : `${flightLabel} · ${hotelLabel}`;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Flights"
        description="Search live flight availability and add to a booking."
      />

      {!live && (
        <div className="bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-lg border p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            Running on <span className="font-medium">sample data</span>. Add your
            Duffel token (<code>DUFFEL_API_TOKEN</code>) for live flights — no
            code changes needed.
          </p>
        </div>
      )}

      {/* SearchWorkspace opens on the Flights tab by default */}
      <SearchWorkspace
        bookings={bookings}
        clients={clients}
        supplierLabel={supplierLabel}
        defaultTab="flights"
        verticals={["flights"]}
      />
    </div>
  );
}
