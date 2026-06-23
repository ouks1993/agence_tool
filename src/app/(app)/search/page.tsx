import { Info } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { SearchWorkspace } from "@/components/search/search-workspace";
import { requireUser } from "@/lib/permissions";
import { listClientOptions, listOpenBookings } from "@/lib/queries";
import { getSupplier, isLiveSupplierConfigured } from "@/lib/suppliers";

export const metadata = { title: "Search" };

export default async function SearchPage() {
  await requireUser();
  const [clients, bookings] = await Promise.all([
    listClientOptions(),
    listOpenBookings(),
  ]);
  const live = isLiveSupplierConfigured();
  const supplierLabel = getSupplier().label;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Search & sourcing"
        description="Find flights and hotels, compare prices, and add them to a booking."
      />

      {!live && (
        <div className="bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-lg border p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            Running on <span className="font-medium">sample data</span>. Add your
            Amadeus API keys (<code>AMADEUS_CLIENT_ID</code> /{" "}
            <code>AMADEUS_CLIENT_SECRET</code>) to <code>.env</code> for live
            flight and hotel prices — no code changes needed.
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
