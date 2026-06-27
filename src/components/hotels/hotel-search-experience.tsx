"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BedDouble,
  Building2,
  Loader2,
  MapPin,
  Scale,
  Search,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_OCCUPANCY,
  OccupancyPicker,
  occupancySummary,
  type Occupancy,
} from "@/components/hotels/occupancy-picker";
import { HotelDestinationInput } from "@/components/search/hotel-destination-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { searchHotelsAction } from "@/lib/actions/search";
import { formatMoney } from "@/lib/format";
import type { HotelOffer } from "@/lib/suppliers";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 8;

type Sort = "recommended" | "price" | "rating" | "distance";

type Form = { city: string; cityCode: string; checkIn: string; checkOut: string; hotelName: string };

/** Stable pseudo distance-from-centre (km) so the filter/sort are deterministic. */
function distanceKm(o: HotelOffer): number {
  let h = 0;
  for (const c of o.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return Math.round(((h % 80) / 10) * 10) / 10; // 0.0–7.9 km
}

/** Encodes the active search so the details page can re-price the same party. */
function detailsHref(o: HotelOffer, form: Form, occ: Occupancy): string {
  const q = new URLSearchParams({
    city: form.city,
    cityCode: form.cityCode,
    checkIn: form.checkIn,
    checkOut: form.checkOut,
    rooms: String(occ.rooms),
    adults: String(occ.adults),
    childAges: occ.childAges.join(","),
    currency: o.currency,
    name: o.name,
  });
  return `/hotels/${encodeURIComponent(o.hotelCode ?? o.id)}?${q.toString()}`;
}

export function HotelSearchExperience() {
  const [form, setForm] = useState<Form>({
    city: "",
    cityCode: "",
    checkIn: "",
    checkOut: "",
    hotelName: "",
  });
  const [occ, setOcc] = useState<Occupancy>(DEFAULT_OCCUPANCY);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<HotelOffer[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("recommended");
  const [page, setPage] = useState(1);
  const [compare, setCompare] = useState<HotelOffer[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const [filters, setFilters] = useState({
    minPrice: "",
    maxPrice: "",
    stars: [] as number[],
    types: [] as string[],
    boards: [] as string[],
    maxDistance: "",
    refundableOnly: false,
    sources: [] as string[],
  });

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNote(null);
    setPage(1);
    setCompare([]);
    const res = await searchHotelsAction({
      city: form.city,
      cityCode: form.cityCode || undefined,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      adults: occ.adults,
      rooms: occ.rooms,
      childAges: occ.childAges,
      hotelName: form.hotelName || undefined,
    });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error ?? "Search failed");
      return;
    }
    setResults(res.results);
    setFilters((f) => ({
      ...f,
      minPrice: "",
      maxPrice: "",
      stars: [],
      types: [],
      boards: [],
      maxDistance: "",
      refundableOnly: false,
      sources: [],
    }));
    if (res.estimatedPricing)
      setNote(
        "Showing real hotels and photos. Live room pricing is temporarily unavailable, so nightly rates are estimated."
      );
    else if (res.degraded) setNote("Live supplier unavailable — showing sample data.");
  };

  // Derived filter option lists.
  const typeOptions = useMemo(
    () => [...new Set((results ?? []).map((o) => o.hotelType).filter(Boolean))] as string[],
    [results]
  );
  const boardOptions = useMemo(
    () => [...new Set((results ?? []).map((o) => o.boardType).filter(Boolean))] as string[],
    [results]
  );
  const sourceOptions = useMemo(
    () => [...new Set((results ?? []).map((o) => o.source))],
    [results]
  );

  const filtered = useMemo(() => {
    if (!results) return null;
    const min = parseFloat(filters.minPrice);
    const max = parseFloat(filters.maxPrice);
    const maxDist = parseFloat(filters.maxDistance);
    const list = results.filter((o) => {
      if (Number.isFinite(min) && o.priceTotal < min) return false;
      if (Number.isFinite(max) && o.priceTotal > max) return false;
      if (filters.stars.length && !filters.stars.includes(o.stars)) return false;
      if (filters.types.length && !(o.hotelType && filters.types.includes(o.hotelType)))
        return false;
      if (filters.boards.length && !(o.boardType && filters.boards.includes(o.boardType)))
        return false;
      if (filters.refundableOnly && !o.refundable) return false;
      if (filters.sources.length && !filters.sources.includes(o.source)) return false;
      if (Number.isFinite(maxDist) && distanceKm(o) > maxDist) return false;
      return true;
    });
    const sorted = list.slice();
    if (sort === "price") sorted.sort((a, b) => a.priceTotal - b.priceTotal);
    else if (sort === "rating")
      sorted.sort((a, b) => (b.reviewScore ?? 0) - (a.reviewScore ?? 0));
    else if (sort === "distance") sorted.sort((a, b) => distanceKm(a) - distanceKm(b));
    return sorted;
  }, [results, filters, sort]);

  const pageCount = filtered ? Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)) : 1;
  const pageItems = filtered?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) ?? [];

  const toggleCompare = (o: HotelOffer) => {
    setCompare((c) => {
      if (c.find((x) => x.id === o.id)) return c.filter((x) => x.id !== o.id);
      if (c.length >= 4) {
        toast.info("Compare up to 4 hotels at a time.");
        return c;
      }
      return [...c, o];
    });
  };

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={run} className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-12">
              <Field label="Destination" className="col-span-2 md:col-span-4">
                <HotelDestinationInput
                  value={form.city}
                  onChange={(v) => setForm((f) => ({ ...f, city: v, cityCode: "" }))}
                  onSelect={(d) => setForm((f) => ({ ...f, city: d.name, cityCode: d.iata }))}
                  placeholder="Start typing a city…"
                />
              </Field>
              <Field label="Dates" className="col-span-2 md:col-span-4">
                <DateRangePicker
                  startDate={form.checkIn}
                  endDate={form.checkOut}
                  onSelect={(start, end) =>
                    setForm((f) => ({ ...f, checkIn: start, checkOut: end }))
                  }
                  startLabel="Check-in"
                  endLabel="Check-out"
                />
              </Field>
              <Field label="Guests & rooms" className="col-span-2 md:col-span-3">
                <OccupancyPicker value={occ} onChange={setOcc} />
              </Field>
              <div className="col-span-2 flex items-end md:col-span-1">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                </Button>
              </div>
            </div>
            <Field label="Hotel name (optional)" className="max-w-sm">
              <Input
                value={form.hotelName}
                onChange={(e) => setForm((f) => ({ ...f, hotelName: e.target.value }))}
                placeholder="e.g. Hilton, Marriott…"
              />
            </Field>
          </form>
        </CardContent>
      </Card>

      {note && <p className="text-muted-foreground text-sm">{note}</p>}

      {results && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_1fr]">
          {/* Filter sidebar */}
          <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <FilterGroup title="Price range">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Min"
                  value={filters.minPrice}
                  onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))}
                  className="h-8"
                />
                <span className="text-muted-foreground text-xs">–</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Max"
                  value={filters.maxPrice}
                  onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))}
                  className="h-8"
                />
              </div>
            </FilterGroup>

            <FilterGroup title="Star rating">
              <div className="flex flex-wrap gap-1.5">
                {[5, 4, 3, 2, 1].map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={filters.stars.includes(s) ? "default" : "outline"}
                    className="h-7 px-2"
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        stars: f.stars.includes(s)
                          ? f.stars.filter((x) => x !== s)
                          : [...f.stars, s],
                      }))
                    }
                  >
                    {s} <Star className="ml-0.5 size-3 fill-current" />
                  </Button>
                ))}
              </div>
            </FilterGroup>

            {typeOptions.length > 0 && (
              <FilterGroup title="Property type">
                <CheckList
                  options={typeOptions}
                  selected={filters.types}
                  onToggle={(v) =>
                    setFilters((f) => ({ ...f, types: toggle(f.types, v) }))
                  }
                />
              </FilterGroup>
            )}

            {boardOptions.length > 0 && (
              <FilterGroup title="Meal plan">
                <CheckList
                  options={boardOptions}
                  selected={filters.boards}
                  onToggle={(v) =>
                    setFilters((f) => ({ ...f, boards: toggle(f.boards, v) }))
                  }
                />
              </FilterGroup>
            )}

            <FilterGroup title="Distance from centre">
              <Select
                value={filters.maxDistance}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, maxDistance: e.target.value }))
                }
                className="h-8 text-xs"
              >
                <option value="">Any distance</option>
                <option value="1">Within 1 km</option>
                <option value="3">Within 3 km</option>
                <option value="5">Within 5 km</option>
              </Select>
            </FilterGroup>

            <FilterGroup title="Cancellation">
              <Button
                type="button"
                size="sm"
                variant={filters.refundableOnly ? "default" : "outline"}
                className="h-7 w-full justify-start"
                onClick={() =>
                  setFilters((f) => ({ ...f, refundableOnly: !f.refundableOnly }))
                }
              >
                Free cancellation only
              </Button>
            </FilterGroup>

            {sourceOptions.length > 1 && (
              <FilterGroup title="Supplier">
                <CheckList
                  options={sourceOptions}
                  selected={filters.sources}
                  onToggle={(v) =>
                    setFilters((f) => ({ ...f, sources: toggle(f.sources, v) }))
                  }
                />
              </FilterGroup>
            )}
          </aside>

          {/* Results list */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-muted-foreground text-sm">
                {filtered?.length ?? 0} propert
                {(filtered?.length ?? 0) === 1 ? "y" : "ies"} · {occupancySummary(occ)}
              </p>
              <div className="ms-auto flex items-center gap-2">
                <Label className="text-muted-foreground text-xs">Sort</Label>
                <Select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value as Sort);
                    setPage(1);
                  }}
                  className="h-8 w-auto text-xs"
                >
                  <option value="recommended">Recommended</option>
                  <option value="price">Lowest price</option>
                  <option value="rating">Highest rating</option>
                  <option value="distance">Distance</option>
                </Select>
              </div>
            </div>

            {pageItems.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {results.length === 0
                  ? "No hotels found for this search."
                  : "No hotels match these filters."}
              </p>
            ) : (
              pageItems.map((o) => (
                <ResultCard
                  key={o.id}
                  offer={o}
                  href={detailsHref(o, form, occ)}
                  distance={distanceKm(o)}
                  selected={Boolean(compare.find((x) => x.id === o.id))}
                  onCompare={() => toggleCompare(o)}
                />
              ))
            )}

            {pageCount > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-muted-foreground text-sm">
                  Page {page} of {pageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compare bar */}
      {compare.length > 0 && (
        <div className="bg-primary text-primary-foreground fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit items-center gap-3 rounded-full px-4 py-2 shadow-lg">
          <Scale className="size-4" />
          <span className="text-sm font-medium">{compare.length} selected</span>
          <Button size="sm" variant="secondary" onClick={() => setShowCompare(true)}>
            Compare
          </Button>
          <button
            type="button"
            onClick={() => setCompare([])}
            aria-label="Clear comparison"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <CompareDialog
        open={showCompare}
        onOpenChange={setShowCompare}
        hotels={compare}
        hrefFor={(o) => detailsHref(o, form, occ)}
      />
    </div>
  );
}

function ResultCard({
  offer: o,
  href,
  distance,
  selected,
  onCompare,
}: {
  offer: HotelOffer;
  href: string;
  distance: number;
  selected: boolean;
  onCompare: () => void;
}) {
  return (
    <Card className={cn("overflow-hidden", selected && "ring-primary ring-2")}>
      <CardContent className="flex flex-col gap-4 p-3 sm:flex-row">
        <div className="bg-muted h-40 w-full shrink-0 overflow-hidden rounded-md sm:h-auto sm:w-52">
          {o.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={o.thumbnail}
              alt={o.name}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full min-h-32 w-full items-center justify-center"
              style={{ backgroundColor: o.thumbnailColor ?? undefined }}
            >
              <BedDouble className="text-muted-foreground size-6" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{o.name}</span>
            <span className="flex items-center text-amber-500">
              {Array.from({ length: o.stars }).map((_, i) => (
                <Star key={i} className="size-3.5 fill-current" />
              ))}
            </span>
            {o.hotelType && (
              <Badge variant="secondary" className="gap-1">
                <Building2 className="size-3" /> {o.hotelType}
              </Badge>
            )}
          </div>
          {(o.address || o.city) && (
            <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
              <MapPin className="size-3" /> {o.address ?? o.city} · {distance} km from centre
            </p>
          )}
          {o.roomName && (
            <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
              <BedDouble className="size-3" /> {o.roomName}
            </p>
          )}
          <p className="text-muted-foreground mt-1 text-xs">
            {o.boardType ?? "Room only"} ·{" "}
            <span className={o.refundable ? "text-green-600 dark:text-green-400" : ""}>
              {o.refundable ? "Free cancellation" : "Non-refundable"}
            </span>
          </p>
          <label className="text-muted-foreground mt-auto flex w-fit cursor-pointer items-center gap-1.5 pt-2 text-xs">
            <input type="checkbox" checked={selected} onChange={onCompare} />
            Compare
          </label>
        </div>

        <div className="flex shrink-0 flex-col items-end justify-between gap-2 text-right">
          {o.reviewScore != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-xs">
                {scoreWord(o.reviewScore)}
              </span>
              <span className="bg-primary text-primary-foreground rounded-md px-1.5 py-0.5 text-sm font-semibold">
                {o.reviewScore.toFixed(1)}
              </span>
            </div>
          )}
          <div>
            <p className="text-lg font-bold">{formatMoney(o.priceTotal, o.currency)}</p>
            <p className="text-muted-foreground text-xs">
              {o.estimated ? "~" : ""}
              {formatMoney(o.pricePerNight, o.currency)}/night · {o.nights}n
            </p>
            {o.estimated && (
              <p className="text-muted-foreground text-[10px]">Estimated rate</p>
            )}
          </div>
          <Button asChild size="sm">
            <Link href={href}>View details</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CompareDialog({
  open,
  onOpenChange,
  hotels,
  hrefFor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hotels: HotelOffer[];
  hrefFor: (o: HotelOffer) => string;
}) {
  const rows: Array<[string, (o: HotelOffer) => React.ReactNode]> = [
    ["Stars", (o) => `${o.stars}★`],
    ["Review", (o) => (o.reviewScore != null ? o.reviewScore.toFixed(1) : "—")],
    ["Room", (o) => o.roomName ?? "—"],
    ["Board", (o) => o.boardType ?? "Room only"],
    ["Cancellation", (o) => (o.refundable ? "Free" : "Non-refundable")],
    ["Total", (o) => formatMoney(o.priceTotal, o.currency)],
    ["Per night", (o) => formatMoney(o.pricePerNight, o.currency)],
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Compare hotels</DialogTitle>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-2 text-start" />
                {hotels.map((o) => (
                  <th key={o.id} className="min-w-40 p-2 text-start align-bottom">
                    <p className="font-semibold">{o.name}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, render]) => (
                <tr key={label} className="border-t">
                  <td className="text-muted-foreground p-2 font-medium">{label}</td>
                  {hotels.map((o) => (
                    <td key={o.id} className="p-2">
                      {render(o)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t">
                <td />
                {hotels.map((o) => (
                  <td key={o.id} className="p-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={hrefFor(o)}>View</Link>
                    </Button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}

function CheckList({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      {options.map((opt) => (
        <label
          key={opt}
          className="flex cursor-pointer items-center gap-2 text-sm capitalize"
        >
          <input
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={() => onToggle(opt)}
          />
          {opt}
        </label>
      ))}
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

function scoreWord(score: number): string {
  if (score >= 9) return "Superb";
  if (score >= 8) return "Very good";
  if (score >= 7) return "Good";
  return "Pleasant";
}
