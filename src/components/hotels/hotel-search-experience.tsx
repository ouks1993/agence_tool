"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BedDouble,
  Building2,
  Heart,
  Loader2,
  MapPin,
  RotateCcw,
  Scale,
  Search,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/app/status-badge";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { Skeleton } from "@/components/ui/skeleton";
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

/** Deterministic cover gradient keyed to the hotel id (used when no photo). */
const COVER_GRADIENTS = [
  "linear-gradient(135deg,#2B59C3 0%,#3E72E0 60%,#1FA2C7 100%)",
  "linear-gradient(135deg,#1E9E6A 0%,#1FA2C7 100%)",
  "linear-gradient(135deg,#7C5CE6 0%,#2B59C3 100%)",
  "linear-gradient(135deg,#1FA2C7 0%,#2B59C3 100%)",
  "linear-gradient(135deg,#B45313 0%,#C2477F 100%)",
  "linear-gradient(135deg,#0E1525 0%,#2B59C3 120%)",
];
function coverGradient(o: HotelOffer): string {
  let h = 0;
  for (const c of o.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COVER_GRADIENTS[h % COVER_GRADIENTS.length]!;
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

/** Score → verdict word + semantic tone (matches the deck's badge-num split). */
function scoreVerdict(score: number): { word: string; tone: "success" | "info" | "neutral" } {
  if (score >= 9) return { word: "Exceptional", tone: "success" };
  if (score >= 8) return { word: "Fabulous", tone: "success" };
  if (score >= 7) return { word: "Very good", tone: "info" };
  return { word: "Pleasant", tone: "neutral" };
}

type Filters = {
  minPrice: string;
  maxPrice: string;
  stars: number[];
  types: string[];
  boards: string[];
  maxDistance: string;
  refundableOnly: boolean;
  sources: string[];
};

const EMPTY_FILTERS: Filters = {
  minPrice: "",
  maxPrice: "",
  stars: [],
  types: [],
  boards: [],
  maxDistance: "",
  refundableOnly: false,
  sources: [],
};

export function HotelSearchExperience({ providerLabel }: { providerLabel: string }) {
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
  const [searched, setSearched] = useState<{ city: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [estimated, setEstimated] = useState(false);
  const [sort, setSort] = useState<Sort>("recommended");
  const [page, setPage] = useState(1);
  const [compare, setCompare] = useState<HotelOffer[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [errors, setErrors] = useState<{ city?: string; dates?: string }>({});

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: { city?: string; dates?: string } = {};
    if (!form.city.trim()) nextErrors.city = "Enter a destination.";
    if (!form.checkIn || !form.checkOut) nextErrors.dates = "Pick check-in and check-out dates.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

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
    setSearched({ city: form.city });
    setFilters(EMPTY_FILTERS);
    setEstimated(Boolean(res.estimatedPricing));
    if (res.estimatedPricing)
      setNote(
        "Showing real hotels and photos. Live room pricing is temporarily unavailable, so nightly rates are estimated."
      );
    else if (res.degraded) setNote("Live supplier unavailable — showing sample data.");
  };

  // --- Derived facet lists + per-option counts (from real result data only). --
  const typeOptions = useMemo(
    () => facetCounts((results ?? []).map((o) => o.hotelType).filter(Boolean) as string[]),
    [results]
  );
  const boardOptions = useMemo(
    () => facetCounts((results ?? []).map((o) => o.boardType).filter(Boolean) as string[]),
    [results]
  );
  const sourceOptions = useMemo(
    () => facetCounts((results ?? []).map((o) => o.source)),
    [results]
  );
  const starCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const o of results ?? []) map.set(o.stars, (map.get(o.stars) ?? 0) + 1);
    return map;
  }, [results]);
  const priceBounds = useMemo(() => {
    if (!results || results.length === 0) return null;
    const vals = results.map((o) => o.priceTotal);
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [results]);
  const refundableCount = useMemo(
    () => (results ?? []).filter((o) => o.refundable).length,
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

  // Map only over geolocated hotels on the current page.
  const mapItems = useMemo(
    () =>
      pageItems.filter(
        (o) => typeof o.latitude === "number" && typeof o.longitude === "number"
      ),
    [pageItems]
  );

  const filtersActive =
    filters.minPrice !== "" ||
    filters.maxPrice !== "" ||
    filters.stars.length > 0 ||
    filters.types.length > 0 ||
    filters.boards.length > 0 ||
    filters.maxDistance !== "" ||
    filters.refundableOnly ||
    filters.sources.length > 0;

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
      {/* Segmented search summary bar */}
      <Card>
        <CardContent className="p-2 sm:p-2.5">
          <form onSubmit={run} noValidate>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-0">
              <SearchSeg label="Destination" className="lg:min-w-[15rem] lg:flex-[1.4]">
                <HotelDestinationInput
                  value={form.city}
                  onChange={(v) => setForm((f) => ({ ...f, city: v, cityCode: "" }))}
                  onSelect={(d) => setForm((f) => ({ ...f, city: d.name, cityCode: d.iata }))}
                  placeholder="Start typing a city…"
                />
              </SearchSeg>
              <SearchSeg label="Dates" className="lg:flex-[1.6]">
                <DateRangePicker
                  startDate={form.checkIn}
                  endDate={form.checkOut}
                  onSelect={(start, end) =>
                    setForm((f) => ({ ...f, checkIn: start, checkOut: end }))
                  }
                  startLabel="Check-in"
                  endLabel="Check-out"
                />
              </SearchSeg>
              <SearchSeg label="Guests & rooms" className="lg:flex-1">
                <OccupancyPicker value={occ} onChange={setOcc} />
              </SearchSeg>
              <SearchSeg label="Hotel name (optional)" className="lg:flex-1">
                <Input
                  value={form.hotelName}
                  onChange={(e) => setForm((f) => ({ ...f, hotelName: e.target.value }))}
                  placeholder="e.g. Hilton…"
                />
              </SearchSeg>
              <div className="flex items-end p-1.5 lg:pl-2">
                <Button type="submit" className="w-full lg:w-auto" disabled={loading} aria-label="Search hotels">
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                  Search
                </Button>
              </div>
            </div>
            {(errors.city || errors.dates) && (
              <p className="text-destructive px-2 pt-2 text-xs" role="alert">
                {errors.city ?? errors.dates}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {note && (
        <p className="text-muted-foreground text-sm" role="status">
          {note}
        </p>
      )}

      {/* Initial empty state */}
      {!results && !loading && (
        <div className="border-border/70 flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <span className="bg-accent text-accent-foreground flex size-16 items-center justify-center rounded-full">
            <BedDouble className="size-7" />
          </span>
          <div className="space-y-1">
            <p className="font-semibold">Search hotels to see availability</p>
            <p className="text-muted-foreground text-sm">
              Pick a destination and dates to load live rates from {providerLabel}.
            </p>
          </div>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && !results && <ResultsSkeleton />}

      {results && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_1fr]">
          {/* Filter rail */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <Card className="overflow-hidden py-0">
              <div className="border-border flex items-center justify-between border-b px-4 py-3.5">
                <p className="text-sm font-semibold">Filters</p>
                {filtersActive && (
                  <button
                    type="button"
                    onClick={() => setFilters(EMPTY_FILTERS)}
                    className="text-primary inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                  >
                    <RotateCcw className="size-3" /> Reset
                  </button>
                )}
              </div>

              {/* Star rating */}
              {starCounts.size > 0 && (
                <FilterBlock title="Star rating">
                  {[5, 4, 3, 2, 1]
                    .filter((s) => starCounts.has(s))
                    .map((s) => (
                      <CheckRow
                        key={s}
                        checked={filters.stars.includes(s)}
                        onCheckedChange={() =>
                          setFilters((f) => ({
                            ...f,
                            stars: f.stars.includes(s)
                              ? f.stars.filter((x) => x !== s)
                              : [...f.stars, s],
                          }))
                        }
                        count={starCounts.get(s)}
                        label={
                          <span className="flex items-center gap-0.5 text-amber-500">
                            {Array.from({ length: s }).map((_, i) => (
                              <Star key={i} className="size-3 fill-current" />
                            ))}
                          </span>
                        }
                      />
                    ))}
                </FilterBlock>
              )}

              {/* Price range — bound to the real min/max of results. */}
              {priceBounds && (
                <FilterBlock title="Price / night">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      aria-label="Minimum total price"
                      placeholder={String(priceBounds.min)}
                      min={priceBounds.min}
                      max={priceBounds.max}
                      value={filters.minPrice}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, minPrice: e.target.value }))
                      }
                      className="h-8 tabular-nums"
                    />
                    <span className="text-muted-foreground text-xs">–</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      aria-label="Maximum total price"
                      placeholder={String(priceBounds.max)}
                      min={priceBounds.min}
                      max={priceBounds.max}
                      value={filters.maxPrice}
                      onChange={(e) =>
                        setFilters((f) => ({ ...f, maxPrice: e.target.value }))
                      }
                      className="h-8 tabular-nums"
                    />
                  </div>
                  <p className="text-muted-foreground mt-2 flex justify-between text-[11px] tabular-nums">
                    <span>{formatMoney(priceBounds.min, results[0]?.currency)}</span>
                    <span>{formatMoney(priceBounds.max, results[0]?.currency)}</span>
                  </p>
                </FilterBlock>
              )}

              {/* Board basis */}
              {boardOptions.length > 0 && (
                <FilterBlock title="Board basis">
                  {boardOptions.map(([opt, count]) => (
                    <CheckRow
                      key={opt}
                      checked={filters.boards.includes(opt)}
                      onCheckedChange={() =>
                        setFilters((f) => ({ ...f, boards: toggle(f.boards, opt) }))
                      }
                      count={count}
                      label={<span className="capitalize">{opt}</span>}
                    />
                  ))}
                </FilterBlock>
              )}

              {/* Property type */}
              {typeOptions.length > 0 && (
                <FilterBlock title="Property type">
                  {typeOptions.map(([opt, count]) => (
                    <CheckRow
                      key={opt}
                      checked={filters.types.includes(opt)}
                      onCheckedChange={() =>
                        setFilters((f) => ({ ...f, types: toggle(f.types, opt) }))
                      }
                      count={count}
                      label={<span className="capitalize">{opt}</span>}
                    />
                  ))}
                </FilterBlock>
              )}

              {/* Cancellation */}
              {refundableCount > 0 && (
                <FilterBlock title="Cancellation">
                  <CheckRow
                    checked={filters.refundableOnly}
                    onCheckedChange={() =>
                      setFilters((f) => ({ ...f, refundableOnly: !f.refundableOnly }))
                    }
                    count={refundableCount}
                    label="Free cancellation"
                  />
                </FilterBlock>
              )}

              {/* Distance from centre */}
              <FilterBlock title="Distance from centre">
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
              </FilterBlock>

              {/* Supplier */}
              {sourceOptions.length > 1 && (
                <FilterBlock title="Supplier">
                  {sourceOptions.map(([opt, count]) => (
                    <CheckRow
                      key={opt}
                      checked={filters.sources.includes(opt)}
                      onCheckedChange={() =>
                        setFilters((f) => ({ ...f, sources: toggle(f.sources, opt) }))
                      }
                      count={count}
                      label={<span className="capitalize">{opt}</span>}
                    />
                  ))}
                </FilterBlock>
              )}
            </Card>
          </aside>

          {/* Results column */}
          <div className="min-w-0 space-y-4">
            {/* Results bar */}
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm">
                <span className="font-semibold tabular-nums">{filtered?.length ?? 0}</span>{" "}
                propert{(filtered?.length ?? 0) === 1 ? "y" : "ies"}
                {searched?.city ? <span className="text-muted-foreground"> in {searched.city}</span> : null}{" "}
                <span className="text-muted-foreground">· {occupancySummary(occ)}</span>
              </p>
              <div className="flex items-center gap-2">
                <StatusBadge
                  variant={estimated ? "warning" : "info"}
                  label={estimated ? `${providerLabel} · estimated rates` : `${providerLabel} live rates`}
                  dot
                />
                <Badge variant="secondary">Supplier net rates</Badge>
              </div>
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
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <span className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-full">
                  <Search className="size-7" />
                </span>
                <div className="space-y-1">
                  <p className="font-semibold">
                    {results.length === 0 ? "No hotels found" : "No hotels match these filters"}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {results.length === 0
                      ? "Try different dates or another destination."
                      : "Loosen or reset your filters to see more results."}
                  </p>
                </div>
                {results.length > 0 && filtersActive && (
                  <Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
                    <RotateCcw className="size-3.5" /> Reset filters
                  </Button>
                )}
              </div>
            ) : (
              <div
                className={cn(
                  "grid items-start gap-5",
                  mapItems.length > 0 ? "xl:grid-cols-[1fr_340px]" : ""
                )}
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {pageItems.map((o) => (
                    <ResultCard
                      key={o.id}
                      offer={o}
                      href={detailsHref(o, form, occ)}
                      distance={distanceKm(o)}
                      selected={Boolean(compare.find((x) => x.id === o.id))}
                      onCompare={() => toggleCompare(o)}
                    />
                  ))}
                </div>

                {/* Map rail — only when real coordinates exist. */}
                {mapItems.length > 0 && (
                  <MapPanel hotels={mapItems} city={searched?.city} />
                )}
              </div>
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
                <span className="text-muted-foreground text-sm tabular-nums">
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
          <button type="button" onClick={() => setCompare([])} aria-label="Clear comparison">
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
  const verdict = o.reviewScore != null ? scoreVerdict(o.reviewScore) : null;
  return (
    <Card
      className={cn(
        "card-interactive overflow-hidden py-0",
        selected && "ring-primary ring-2"
      )}
    >
      {/* Cover */}
      <div className="relative flex h-32 items-end p-3 text-white">
        {o.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={o.thumbnail}
            alt={o.name}
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: coverGradient(o) }}
            aria-hidden="true"
          />
        )}
        <div
          className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0E1525]/60"
          aria-hidden="true"
        />
        {o.stars > 0 && (
          <span className="absolute top-3 left-3 flex items-center gap-0.5 text-amber-300 drop-shadow">
            {Array.from({ length: o.stars }).map((_, i) => (
              <Star key={i} className="size-3.5 fill-current" />
            ))}
          </span>
        )}
        <button
          type="button"
          onClick={onCompare}
          aria-label={selected ? `Remove ${o.name} from comparison` : `Add ${o.name} to comparison`}
          aria-pressed={selected}
          className={cn(
            "absolute top-2.5 right-2.5 flex size-7 items-center justify-center rounded-full shadow-sm transition-colors",
            selected
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground bg-white/90 hover:text-foreground"
          )}
        >
          <Heart className={cn("size-4", selected && "fill-current")} />
        </button>
        <span className="relative z-[2] text-[15px] font-bold drop-shadow-sm">{o.name}</span>
        <span className="absolute right-3 bottom-3 z-[2]">
          <StatusBadge
            variant={o.refundable ? "success" : "danger"}
            label={o.refundable ? "Refundable" : "Non-refundable"}
            dot
          />
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <MapPin className="text-muted-foreground/70 size-3.5 shrink-0" />
          <span className="truncate">{o.address ?? o.city}</span>
          <span className="text-muted-foreground/70 shrink-0">· {distance} km from centre</span>
        </p>

        {verdict && o.reviewScore != null && (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-6 items-center rounded-sm px-1.5 text-xs font-bold text-white tabular-nums",
                verdict.tone === "success" && "bg-success",
                verdict.tone === "info" && "bg-info",
                verdict.tone === "neutral" && "bg-muted-foreground"
              )}
            >
              {o.reviewScore.toFixed(1)}
            </span>
            <span className="text-xs font-semibold">{verdict.word}</span>
          </div>
        )}

        {/* Amenity/attribute pills — derived from real offer fields only. */}
        <div className="flex flex-wrap gap-1.5">
          {o.hotelType && <AttrPill icon={<Building2 className="size-3" />}>{o.hotelType}</AttrPill>}
          {o.boardType && <AttrPill icon={<BedDouble className="size-3" />}>{o.boardType}</AttrPill>}
          {o.roomName && <AttrPill>{o.roomName}</AttrPill>}
        </div>

        {/* Footer: price + actions */}
        <div className="border-border mt-auto flex items-end justify-between gap-3 border-t pt-3">
          <div>
            <p className="text-muted-foreground text-[11px]">from</p>
            <p className="text-lg leading-tight font-bold tabular-nums">
              {o.estimated ? "~" : ""}
              {formatMoney(o.priceTotal, o.currency)}
            </p>
            <p className="text-muted-foreground text-[11px] tabular-nums">
              {formatMoney(o.pricePerNight, o.currency)}/night · {o.nights}n
            </p>
            {o.estimated && (
              <p className="text-warning text-[11px] font-semibold">Estimated rate</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button asChild size="sm" variant="outline">
              <Link href={href}>View rooms</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={href}>Select</Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Live map rail over the geolocated hotels. Uses the same OpenStreetMap embed as
 * the details page, framed to the bounding box of all pinned hotels, plus a
 * price legend Card. Only rendered when at least one hotel carries real coords.
 */
function MapPanel({ hotels, city }: { hotels: HotelOffer[]; city?: string | undefined }) {
  const lats = hotels.map((h) => h.latitude!);
  const lngs = hotels.map((h) => h.longitude!);
  const pad = 0.02;
  const minLng = Math.min(...lngs) - pad;
  const maxLng = Math.max(...lngs) + pad;
  const minLat = Math.min(...lats) - pad;
  const maxLat = Math.max(...lats) + pad;
  // OSM embed supports a single marker; centre it on the first hotel.
  const marker = `${hotels[0]!.latitude}%2C${hotels[0]!.longitude}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${marker}`;
  const legend = hotels.slice(0, 5);

  return (
    <div className="hidden xl:sticky xl:top-20 xl:block xl:self-start">
      <div className="border-border overflow-hidden rounded-lg border">
        <iframe
          title="Hotel locations map"
          src={src}
          className="h-[300px] w-full"
          loading="lazy"
        />
      </div>
      <Card className="mt-3 py-0">
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              On this map{city ? ` · ${city}` : ""}
            </p>
            <span className="text-muted-foreground text-[11px]">prices / total</span>
          </div>
          <ul className="divide-border divide-y">
            {legend.map((h) => (
              <li key={h.id} className="flex items-center gap-2 py-1.5 text-sm">
                <MapPin className="text-primary size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{h.name}</span>
                <span className="tabular-nums font-medium">
                  {formatMoney(h.priceTotal, h.currency)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function AttrPill({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="bg-muted text-muted-foreground border-border inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-medium capitalize">
      {icon}
      {children}
    </span>
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
    ["Total", (o) => <span className="tabular-nums">{formatMoney(o.priceTotal, o.currency)}</span>],
    ["Per night", (o) => <span className="tabular-nums">{formatMoney(o.pricePerNight, o.currency)}</span>],
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

function ResultsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_1fr]">
      <Skeleton className="hidden h-96 w-full rounded-lg lg:block" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="overflow-hidden py-0">
            <Skeleton className="h-32 w-full rounded-none" />
            <div className="space-y-3 p-4">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-5 w-24" />
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
              <div className="border-border flex items-end justify-between border-t pt-3">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-28" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** A segment of the search summary bar: uppercase micro-label + control. */
function SearchSeg({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-border flex min-w-0 flex-col gap-1 px-3 py-2 lg:border-l lg:first:border-l-0",
        className
      )}
    >
      <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

function FilterBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-border space-y-1.5 border-b px-4 py-4 last:border-b-0">
      <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

/** A designed checkbox filter row with a label and a right-aligned count. */
function CheckRow({
  checked,
  onCheckedChange,
  count,
  label,
}: {
  checked: boolean;
  onCheckedChange: () => void;
  count?: number | undefined;
  label: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm">
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
      <span className="min-w-0 flex-1">{label}</span>
      {count != null && (
        <span className="text-muted-foreground text-[11px] tabular-nums">{count}</span>
      )}
    </label>
  );
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

/** Count occurrences of each string, sorted by count desc then label. */
function facetCounts(values: string[]): Array<[string, number]> {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
