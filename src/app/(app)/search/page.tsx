import { getTranslations } from "next-intl/server";
import { Info } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { SearchWorkspace } from "@/components/search/search-workspace";
import { requireAgencyUser } from "@/lib/permissions";
import { listClientOptions, listOpenBookings } from "@/lib/queries";
import { isLiveSupplierConfigured } from "@/lib/suppliers";
import {
  getActiveFlightProvider,
  getActiveHotelProvider,
} from "@/lib/travel-platform";

export const metadata = { title: "Search" };

export default async function SearchPage() {
  const user = await requireAgencyUser();
  const t = await getTranslations("search");
  const [clients, bookings] = await Promise.all([
    listClientOptions(user.agencyId),
    listOpenBookings(user.agencyId),
  ]);
  const live = isLiveSupplierConfigured();
  const flightLabel = getActiveFlightProvider().label;
  const hotelLabel = getActiveHotelProvider().label;
  const supplierLabel =
    flightLabel === hotelLabel
      ? flightLabel
      : `${flightLabel} · ${hotelLabel}`;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={t("title")}
        description="Find flights and hotels, compare prices, and add them to a booking."
      />

      {!live && (
        <div className="bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-lg border p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            Running on <span className="font-medium">sample data</span>. Add your
            Duffel token (<code>DUFFEL_API_TOKEN</code>) for live flights and
            Hotelbeds keys (<code>HOTELBEDS_API_KEY</code> /{" "}
            <code>HOTELBEDS_SECRET</code>) for live hotels — no code changes needed.
          </p>
        </div>
      )}

      <SearchWorkspace
        bookings={bookings}
        clients={clients}
        supplierLabel={supplierLabel}
      />
    </div>
  );
}
