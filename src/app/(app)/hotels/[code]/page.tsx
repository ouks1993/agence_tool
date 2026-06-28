import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HotelDetailsView } from "@/components/hotels/hotel-details-view";
import type { Occupancy } from "@/components/hotels/occupancy-picker";
import { Button } from "@/components/ui/button";
import { requireAgencyUser } from "@/lib/permissions";
import {
  listClientOptions,
  listDraftProposals,
  listOpenBookings,
} from "@/lib/queries";
import { mockHotelContent, type HotelDetails } from "@/lib/suppliers";
import { isHotelProviderConfigured } from "@/lib/travel-platform";
import { getHotelContentCached } from "@/lib/suppliers/content-cache";

export const metadata = { title: "Hotel details" };

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default async function HotelDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAgencyUser();
  const { code } = await params;
  const sp = await searchParams;
  const hotelCode = decodeURIComponent(code);

  const get = (k: string): string | undefined =>
    typeof sp[k] === "string" ? (sp[k] as string) : undefined;

  const occupancy: Occupancy = {
    rooms: num(get("rooms"), 1),
    adults: num(get("adults"), 2),
    childAges: (get("childAges") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 17),
  };
  const dates = { checkIn: get("checkIn") ?? "", checkOut: get("checkOut") ?? "" };
  const city = get("city") ?? "";
  const cityCode = get("cityCode") ?? "";
  const currency = get("currency") ?? "EUR";
  const name = get("name") ?? "Hotel";

  // Prefer real Hotelbeds content (photos, facilities, map) for live codes; fall
  // back to illustrative sample content (with images) for mock codes or whenever
  // the live content call is unavailable (e.g. quota exhausted), so the gallery
  // and per-room photos never render blank.
  let content: HotelDetails | null = null;
  if (isHotelProviderConfigured() && !hotelCode.startsWith("mock-")) {
    // Cache-first: serves real photos quota-free, fetching live only on a miss.
    content = await getHotelContentCached(hotelCode);
  }
  if (!content) content = mockHotelContent(hotelCode, name, city);

  const [drafts, clients, bookings] = await Promise.all([
    listDraftProposals(user.agencyId),
    listClientOptions(user.agencyId),
    listOpenBookings(user.agencyId),
  ]);

  return (
    <div className="container mx-auto space-y-5 px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="-ms-2 w-fit">
        <Link href="/hotels">
          <ArrowLeft className="size-4" /> Back to results
        </Link>
      </Button>

      <HotelDetailsView
        hotelCode={hotelCode}
        name={name}
        city={city}
        cityCode={cityCode}
        currency={currency}
        content={content}
        initialOccupancy={occupancy}
        initialDates={dates}
        drafts={drafts}
        clients={clients}
        bookings={bookings}
      />
    </div>
  );
}
