import { Info } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { HotelSearchExperience } from "@/components/hotels/hotel-search-experience";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { requireAgencyUser } from "@/lib/permissions";
import {
  getActiveHotelProvider,
  isHotelProviderConfigured,
} from "@/lib/travel-platform";

export const metadata = { title: "Hotels" };

export default async function HotelsPage() {
  await requireAgencyUser();
  const live = isHotelProviderConfigured();
  const providerLabel = getActiveHotelProvider().label;

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>Search</BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Hotels</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title="Hotel search"
        description="Search, compare and select hotels, then add them to a proposal."
      >
        <span className="text-muted-foreground text-xs">Source: {providerLabel}</span>
      </PageHeader>

      {!live && (
        <div className="bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-lg border p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            Running on <span className="font-medium">sample data</span>. Add your
            Hotelbeds keys (<code>HOTELBEDS_API_KEY</code> /{" "}
            <code>HOTELBEDS_SECRET</code>) for live availability and pricing — no code
            changes needed.
          </p>
        </div>
      )}

      <HotelSearchExperience providerLabel={providerLabel} />
    </div>
  );
}
