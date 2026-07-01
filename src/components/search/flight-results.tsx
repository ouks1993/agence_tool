"use client";

import { useMemo, useState } from "react";
import {
  Plane,
  Briefcase,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Plus,
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import {
  AddToBookingDialog,
  type BookingOption,
  type ClientOption,
} from "@/components/search/add-to-booking-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { BookingItemInput } from "@/lib/actions/bookings";
import { formatMoney, formatDuration, formatTime } from "@/lib/format";
import type { FlightOffer, FlightSegment, CabinClass } from "@/lib/suppliers";
import { cn } from "@/lib/utils";

type SortKey = "best" | "cheapest" | "fastest";

/** A departure window bucket. */
const WINDOWS = [
  { key: "morning", label: "Morning", sub: "06–12", icon: Sunrise, from: 6, to: 12 },
  { key: "afternoon", label: "Afternoon", sub: "12–18", icon: Sun, from: 12, to: 18 },
  { key: "evening", label: "Evening", sub: "18–24", icon: Sunset, from: 18, to: 24 },
  { key: "night", label: "Night", sub: "00–06", icon: Moon, from: 0, to: 6 },
] as const;

type WindowKey = (typeof WINDOWS)[number]["key"];

const CABIN_LABELS: Record<CabinClass, string> = {
  economy: "Economy",
  premium: "Premium",
  business: "Business",
  first: "First",
};

/** How many fares to render before the "Show more fares" control. */
const PAGE_SIZE = 8;

function stopBucket(stops: number): "0" | "1" | "2" {
  if (stops <= 0) return "0";
  if (stops === 1) return "1";
  return "2";
}

function departHour(o: FlightOffer): number {
  const iso = o.segments[0]?.departAt;
  if (!iso) return -1;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? -1 : d.getHours();
}

function windowOf(hour: number): WindowKey | null {
  if (hour < 0) return null;
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18) return "evening";
  return "night";
}

export type FlightResultsProps = {
  results: FlightOffer[];
  route: { origin: string; destination: string };
  adults: number;
  bookings: BookingOption[];
  clients: ClientOption[];
  defaultBookingId?: string | undefined;
  /** Builds the booking-item payload for the add-to-proposal/booking dialog. */
  toItem: (offer: FlightOffer) => BookingItemInput;
};

export function FlightResults({
  results,
  route,
  adults,
  bookings,
  clients,
  defaultBookingId,
  toItem,
}: FlightResultsProps) {
  const [sort, setSort] = useState<SortKey>("best");
  const [stops, setStops] = useState<Set<"0" | "1" | "2">>(new Set());
  const [airlines, setAirlines] = useState<Set<string>>(new Set());
  const [windows, setWindows] = useState<Set<WindowKey>>(new Set());
  const [cabins, setCabins] = useState<Set<CabinClass>>(new Set());
  const [visible, setVisible] = useState(PAGE_SIZE);

  // --- Facets derived from the REAL result set ------------------------------
  const stopFacets = useMemo(() => {
    const counts = { "0": 0, "1": 0, "2": 0 } as Record<"0" | "1" | "2", number>;
    for (const o of results) counts[stopBucket(o.stops)] += 1;
    return counts;
  }, [results]);

  const airlineFacets = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const o of results) {
      const cur = map.get(o.airlineCode) ?? { name: o.airlineName, count: 0 };
      cur.count += 1;
      map.set(o.airlineCode, cur);
    }
    return [...map.entries()]
      .map(([code, v]) => ({ code, ...v }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [results]);

  const windowFacets = useMemo(() => {
    const counts: Record<WindowKey, number> = {
      morning: 0,
      afternoon: 0,
      evening: 0,
      night: 0,
    };
    for (const o of results) {
      const w = windowOf(departHour(o));
      if (w) counts[w] += 1;
    }
    return counts;
  }, [results]);

  const cabinFacets = useMemo(() => {
    const map = new Map<CabinClass, number>();
    for (const o of results) map.set(o.cabin, (map.get(o.cabin) ?? 0) + 1);
    return (["economy", "premium", "business", "first"] as CabinClass[])
      .filter((c) => map.has(c))
      .map((c) => ({ cabin: c, count: map.get(c)! }));
  }, [results]);

  const priceRange = useMemo(() => {
    if (results.length === 0) return null;
    const prices = results.map((o) => o.priceTotal);
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [results]);

  // Live price bounds (per-traveller when we know the pax count). Two knobs the
  // agent can drag to constrain fares — bound to the REAL min/max of results.
  const [priceBounds, setPriceBounds] = useState<[number, number] | null>(null);
  const activeBounds = useMemo<[number, number] | null>(() => {
    if (!priceRange) return null;
    return priceBounds ?? [priceRange.min, priceRange.max];
  }, [priceRange, priceBounds]);

  // --- Client-side filtering ------------------------------------------------
  const filtered = useMemo(() => {
    return results.filter((o) => {
      if (stops.size && !stops.has(stopBucket(o.stops))) return false;
      if (airlines.size && !airlines.has(o.airlineCode)) return false;
      if (cabins.size && !cabins.has(o.cabin)) return false;
      if (windows.size) {
        const w = windowOf(departHour(o));
        if (!w || !windows.has(w)) return false;
      }
      if (activeBounds) {
        if (o.priceTotal < activeBounds[0] || o.priceTotal > activeBounds[1])
          return false;
      }
      return true;
    });
  }, [results, stops, airlines, cabins, windows, activeBounds]);

  // Ribbon badges derived from the full result set.
  const cheapestId = useMemo(() => {
    if (results.length === 0) return null;
    return results.reduce((a, b) => (b.priceTotal < a.priceTotal ? b : a)).id;
  }, [results]);
  const fastestId = useMemo(() => {
    if (results.length === 0) return null;
    return results.reduce((a, b) =>
      b.durationMinutes < a.durationMinutes ? b : a
    ).id;
  }, [results]);
  const bestValueId = useMemo(() => {
    // Best value = a direct fare with the lowest price; falls back to cheapest.
    const directs = results.filter((o) => o.stops === 0);
    const pool = directs.length ? directs : results;
    if (pool.length === 0) return null;
    return pool.reduce((a, b) => (b.priceTotal < a.priceTotal ? b : a)).id;
  }, [results]);
  const businessId = useMemo(() => {
    const biz = results.filter(
      (o) => o.cabin === "business" || o.cabin === "first"
    );
    if (biz.length === 0) return null;
    // Highlight the priciest premium fare as the upgrade option.
    return biz.reduce((a, b) => (b.priceTotal > a.priceTotal ? b : a)).id;
  }, [results]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "cheapest") arr.sort((a, b) => a.priceTotal - b.priceTotal);
    else if (sort === "fastest")
      arr.sort((a, b) => a.durationMinutes - b.durationMinutes);
    else {
      // Best value: directs first, then by price.
      arr.sort(
        (a, b) =>
          Number(a.stops > 0) - Number(b.stops > 0) ||
          a.priceTotal - b.priceTotal
      );
    }
    return arr;
  }, [filtered, sort]);

  const cheapestPrice = useMemo(
    () => (filtered.length ? Math.min(...filtered.map((o) => o.priceTotal)) : null),
    [filtered]
  );
  const fastestDuration = useMemo(
    () =>
      filtered.length
        ? Math.min(...filtered.map((o) => o.durationMinutes))
        : null,
    [filtered]
  );

  const currency = results[0]?.currency ?? "DZD";
  const routeLabel = `${route.origin.toUpperCase()} → ${route.destination.toUpperCase()}`;

  const anyFilter =
    stops.size || airlines.size || windows.size || cabins.size || priceBounds;
  const resetFilters = () => {
    setStops(new Set());
    setAirlines(new Set());
    setWindows(new Set());
    setCabins(new Set());
    setPriceBounds(null);
  };

  const toggle = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  if (results.length === 0) {
    return (
      <EmptyState
        icon={Plane}
        title="No flights found"
        description="Try different dates, nearby airports, or another cabin class."
      />
    );
  }

  const shown = sorted.slice(0, visible);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[256px_1fr] lg:items-start">
      {/* -------- FILTERS -------- */}
      <aside className="lg:sticky lg:top-4">
        <Card className="card-elevated overflow-hidden p-0">
          <div className="flex items-center justify-between px-4 pt-4">
            <span className="text-sm font-semibold">Filters</span>
            {anyFilter ? (
              <button
                type="button"
                onClick={resetFilters}
                className="text-primary text-xs font-medium hover:underline"
              >
                Reset
              </button>
            ) : null}
          </div>

          <div className="px-4 pb-4">
            {/* Stops */}
            <FilterGroup title="Stops">
              <CheckRow
                label="Direct"
                count={stopFacets["0"]}
                checked={stops.has("0")}
                disabled={stopFacets["0"] === 0}
                onToggle={() => setStops((s) => toggle(s, "0"))}
              />
              <CheckRow
                label="1 stop"
                count={stopFacets["1"]}
                checked={stops.has("1")}
                disabled={stopFacets["1"] === 0}
                onToggle={() => setStops((s) => toggle(s, "1"))}
              />
              <CheckRow
                label="2+ stops"
                count={stopFacets["2"]}
                checked={stops.has("2")}
                disabled={stopFacets["2"] === 0}
                onToggle={() => setStops((s) => toggle(s, "2"))}
              />
            </FilterGroup>

            {/* Airlines */}
            {airlineFacets.length > 0 && (
              <FilterGroup
                title="Airlines"
                action={
                  airlines.size ? (
                    <button
                      type="button"
                      onClick={() => setAirlines(new Set())}
                      className="text-primary text-xs font-medium hover:underline"
                    >
                      All
                    </button>
                  ) : undefined
                }
              >
                {airlineFacets.map((a) => (
                  <CheckRow
                    key={a.code}
                    label={a.name}
                    count={a.count}
                    checked={airlines.has(a.code)}
                    onToggle={() => setAirlines((s) => toggle(s, a.code))}
                  />
                ))}
              </FilterGroup>
            )}

            {/* Departure window */}
            <FilterGroup title="Departure window">
              <div className="grid grid-cols-2 gap-2">
                {WINDOWS.map((w) => {
                  const count = windowFacets[w.key];
                  const on = windows.has(w.key);
                  const Icon = w.icon;
                  return (
                    <button
                      key={w.key}
                      type="button"
                      disabled={count === 0}
                      onClick={() => setWindows((s) => toggle(s, w.key))}
                      className={cn(
                        "flex flex-col items-center gap-0.5 rounded-md border px-2 py-2 text-center transition-colors",
                        on
                          ? "border-primary bg-accent"
                          : "border-border hover:bg-muted/50",
                        count === 0 && "cursor-not-allowed opacity-40"
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4",
                          on ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span className="text-foreground text-xs font-semibold">
                        {w.label}
                      </span>
                      <span className="text-muted-foreground text-[10px] tabular-nums">
                        {w.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </FilterGroup>

            {/* Price — real dual-knob range bound to actual fares */}
            {priceRange && activeBounds && priceRange.max > priceRange.min && (
              <FilterGroup
                title="Price"
                action={
                  priceBounds ? (
                    <button
                      type="button"
                      onClick={() => setPriceBounds(null)}
                      className="text-primary text-xs font-medium hover:underline"
                    >
                      Reset
                    </button>
                  ) : undefined
                }
              >
                <PriceRange
                  min={priceRange.min}
                  max={priceRange.max}
                  value={activeBounds}
                  currency={currency}
                  onChange={setPriceBounds}
                />
              </FilterGroup>
            )}

            {/* Cabin — derived from real offer.cabin */}
            {cabinFacets.length > 1 && (
              <FilterGroup title="Cabin">
                {cabinFacets.map((c) => (
                  <CheckRow
                    key={c.cabin}
                    label={CABIN_LABELS[c.cabin]}
                    count={c.count}
                    checked={cabins.has(c.cabin)}
                    onToggle={() => setCabins((s) => toggle(s, c.cabin))}
                  />
                ))}
              </FilterGroup>
            )}
          </div>
        </Card>
      </aside>

      {/* -------- RESULTS COLUMN -------- */}
      <section className="min-w-0">
        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            <span className="text-foreground font-semibold">
              {sorted.length} {sorted.length === 1 ? "flight" : "flights"}
            </span>{" "}
            · {routeLabel}
            {adults > 0 && (
              <>
                {" "}· prices for {adults} traveller{adults === 1 ? "" : "s"}
              </>
            )}
          </p>
          <div className="bg-muted flex items-center gap-0.5 rounded-md border p-0.5">
            <SortPill active={sort === "best"} onClick={() => setSort("best")}>
              Best value
            </SortPill>
            <SortPill
              active={sort === "cheapest"}
              onClick={() => setSort("cheapest")}
              hint={cheapestPrice != null ? formatMoney(cheapestPrice, currency) : undefined}
            >
              Cheapest
            </SortPill>
            <SortPill
              active={sort === "fastest"}
              onClick={() => setSort("fastest")}
              hint={fastestDuration != null ? formatDuration(fastestDuration) : undefined}
            >
              Fastest
            </SortPill>
          </div>
        </div>

        {sorted.length === 0 ? (
          <EmptyState
            icon={Plane}
            title="No flights match these filters"
            description="Clear or relax the filters to see more results."
          />
        ) : (
          <>
            <div className="space-y-3.5">
              {shown.map((o) => {
                let ribbon: { label: string; tone: "brand" | "success" | "warning" } | null =
                  null;
                if (o.id === bestValueId) ribbon = { label: "Best value", tone: "success" };
                else if (o.id === cheapestId) ribbon = { label: "Cheapest", tone: "success" };
                else if (o.id === businessId)
                  ribbon = { label: "Business upgrade", tone: "warning" };
                else if (o.stops === 0) ribbon = { label: "Direct", tone: "brand" };
                return (
                  <FlightCard
                    key={o.id}
                    offer={o}
                    adults={adults}
                    ribbon={ribbon}
                    featured={o.id === bestValueId}
                    fastest={o.id === fastestId}
                    bookings={bookings}
                    clients={clients}
                    defaultBookingId={defaultBookingId}
                    routeLabel={routeLabel}
                    toItem={toItem}
                  />
                );
              })}
            </div>

            {sorted.length > visible && (
              <div className="mt-4 flex justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                >
                  Show {Math.min(PAGE_SIZE, sorted.length - visible)} more fare
                  {sorted.length - visible === 1 ? "" : "s"}
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

// --- Filter primitives ------------------------------------------------------

function FilterGroup({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border border-b py-4 last:border-b-0 last:pb-1">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-foreground text-xs font-semibold">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function CheckRow({
  label,
  count,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  count: number;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 py-1.5",
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={onToggle}
      />
      <span className="text-foreground flex-1 text-sm">{label}</span>
      <span className="text-muted-foreground text-xs tabular-nums">{count}</span>
    </label>
  );
}

/** Dual-knob price range bound to the real min/max fares in the result set. */
function PriceRange({
  min,
  max,
  value,
  currency,
  onChange,
}: {
  min: number;
  max: number;
  value: [number, number];
  currency: string;
  onChange: (v: [number, number]) => void;
}) {
  const [lo, hi] = value;
  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  return (
    <div>
      <div className="text-foreground mb-1 flex items-center justify-between text-xs font-medium tabular-nums">
        <span>{formatMoney(lo, currency)}</span>
        <span>{formatMoney(hi, currency)}</span>
      </div>
      <div className="relative mx-1 mt-3 mb-2 h-1.5">
        <div className="bg-border absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full" />
        <div
          className="bg-primary absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
          style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
        />
        {/* Lower knob */}
        <input
          type="range"
          aria-label="Minimum price"
          min={min}
          max={max}
          value={lo}
          onChange={(e) =>
            onChange([Math.min(Number(e.target.value), hi), hi])
          }
          className="range-thumb pointer-events-none absolute inset-0 h-1.5 w-full appearance-none bg-transparent"
        />
        {/* Upper knob */}
        <input
          type="range"
          aria-label="Maximum price"
          min={min}
          max={max}
          value={hi}
          onChange={(e) =>
            onChange([lo, Math.max(Number(e.target.value), lo)])
          }
          className="range-thumb pointer-events-none absolute inset-0 h-1.5 w-full appearance-none bg-transparent"
        />
      </div>
      <style jsx>{`
        .range-thumb::-webkit-slider-thumb {
          pointer-events: auto;
          appearance: none;
          height: 15px;
          width: 15px;
          border-radius: 9999px;
          background: var(--background);
          border: 2px solid var(--primary);
          box-shadow: var(--shadow-sm);
          cursor: pointer;
        }
        .range-thumb::-moz-range-thumb {
          pointer-events: auto;
          height: 15px;
          width: 15px;
          border-radius: 9999px;
          background: var(--background);
          border: 2px solid var(--primary);
          box-shadow: var(--shadow-sm);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

function SortPill({
  active,
  onClick,
  hint,
  children,
}: {
  active: boolean;
  onClick: () => void;
  hint?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
      {hint && (
        <span className="text-success font-semibold tabular-nums">{hint}</span>
      )}
    </button>
  );
}

// --- Flight card ------------------------------------------------------------

/**
 * Brand colours for known IATA carriers → a subtle top-lit gradient, matching
 * the mockup's airline-logo blocks. Unknown carriers fall back to a
 * deterministic tint so the mark is stable per code (presentation only).
 */
const AIRLINE_BRANDS: Record<string, string> = {
  EK: "linear-gradient(135deg,#C8102E,#9e0c24)", // Emirates
  AH: "linear-gradient(135deg,#0A6B3B,#07502c)", // Air Algérie
  TK: "linear-gradient(135deg,#C8102E,#a00d24)", // Turkish
  QR: "linear-gradient(135deg,#5C0632,#3f0422)", // Qatar
  AF: "linear-gradient(135deg,#1B3C8C,#122a63)", // Air France
  BA: "linear-gradient(135deg,#1D4696,#132f66)", // British Airways
  LH: "linear-gradient(135deg,#05164D,#030d30)", // Lufthansa
  EY: "linear-gradient(135deg,#BD8B13,#8c680e)", // Etihad
  SV: "linear-gradient(135deg,#0C592E,#083f20)", // Saudia
  MS: "linear-gradient(135deg,#003C71,#002b51)", // EgyptAir
};
const FALLBACK_MARKS = [
  "linear-gradient(135deg,#334155,#1e293b)",
  "linear-gradient(135deg,#3F4A63,#2a3346)",
  "linear-gradient(135deg,#4B5563,#374151)",
];
function markGradient(code: string): string {
  const known = AIRLINE_BRANDS[code.toUpperCase()];
  if (known) return known;
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return FALLBACK_MARKS[h % FALLBACK_MARKS.length]!;
}

function FlightCard({
  offer,
  adults,
  ribbon,
  featured,
  fastest,
  bookings,
  clients,
  defaultBookingId,
  routeLabel,
  toItem,
}: {
  offer: FlightOffer;
  adults: number;
  ribbon: { label: string; tone: "brand" | "success" | "warning" } | null;
  featured: boolean;
  fastest: boolean;
  bookings: BookingOption[];
  clients: ClientOption[];
  defaultBookingId?: string | undefined;
  routeLabel: string;
  toItem: (offer: FlightOffer) => BookingItemInput;
}) {
  const outbound = offer.segments;
  const inbound = offer.returnSegments;

  const summary = `${offer.airlineName} · ${formatMoney(offer.priceTotal, offer.currency)}`;

  return (
    <Card
      className={cn(
        "card-interactive relative overflow-hidden p-0",
        featured && "border-[#C9D8F6] shadow-md dark:border-primary/40"
      )}
    >
      {ribbon && (
        <span
          className={cn(
            "absolute left-0 top-0 z-10 inline-flex items-center gap-1 rounded-br-md px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white",
            ribbon.tone === "success" && "bg-success",
            ribbon.tone === "warning" && "bg-warning",
            ribbon.tone === "brand" && "bg-primary"
          )}
        >
          {ribbon.label}
        </span>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px]">
        {/* Itinerary */}
        <div className={cn("p-5", ribbon && "pt-8")}>
          <Leg segments={outbound} airlineName={offer.airlineName} airlineCode={offer.airlineCode} />
          {inbound && inbound.length > 0 && (
            <div className="border-border mt-4 border-t border-dashed pt-4">
              <Leg
                segments={inbound}
                airlineName={offer.airlineName}
                airlineCode={offer.airlineCode}
              />
            </div>
          )}

          {/* Chips row — only fields backed by real data */}
          <div className="border-border mt-4 flex flex-wrap gap-2 border-t pt-3.5">
            <Chip icon={Briefcase}>{CABIN_LABELS[offer.cabin]}</Chip>
            <Chip>
              {offer.stops === 0
                ? "Direct itinerary"
                : `${offer.stops} stop${offer.stops > 1 ? "s" : ""}`}
            </Chip>
            <Chip>{formatDuration(offer.durationMinutes)}</Chip>
            {fastest && <Chip>Fastest option</Chip>}
          </div>
        </div>

        {/* Price rail */}
        <div className="bg-surface-2 border-border flex flex-col justify-center gap-1 border-t p-5 sm:border-l sm:border-t-0">
          {adults > 0 && (
            <p className="text-muted-foreground text-xs">
              {adults} traveller{adults === 1 ? "" : "s"} · total
            </p>
          )}
          <p className="text-muted-foreground text-[11px]">from</p>
          <p className="text-foreground text-2xl font-bold tabular-nums leading-none tracking-tight">
            {formatMoney(offer.priceTotal, offer.currency)}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {/* Primary conversion path: commit the fare into a booking. */}
            <AddToBookingDialog
              item={toItem(offer)}
              itemSummary={summary}
              bookings={bookings}
              clients={clients}
              defaultBookingId={defaultBookingId}
              defaultDestination={routeLabel}
              trigger={
                <Button size="sm" className="w-full">
                  Select
                </Button>
              }
            />
            <AddToBookingDialog
              item={toItem(offer)}
              itemSummary={summary}
              bookings={bookings}
              clients={clients}
              defaultBookingId={defaultBookingId}
              defaultDestination={routeLabel}
              trigger={
                <Button size="sm" variant="outline" className="w-full">
                  <Plus className="size-4" />
                  Add to proposal
                </Button>
              }
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function Leg({
  segments,
  airlineName,
  airlineCode,
}: {
  segments: FlightSegment[];
  airlineName: string;
  airlineCode: string;
}) {
  const first = segments[0];
  const last = segments.at(-1);
  if (!first || !last) return null;

  const totalMinutes = segments.reduce((sum, s) => sum + s.durationMinutes, 0);
  const stopCount = Math.max(0, segments.length - 1);
  const flightNumbers = segments.map((s) => s.flightNumber).join(" · ");
  const stopVias = segments
    .slice(1)
    .map((s) => s.from)
    .join(", ");

  // Day offset between departure and arrival.
  const dep = new Date(first.departAt);
  const arr = new Date(last.arriveAt);
  const dayOffset =
    !Number.isNaN(dep.getTime()) && !Number.isNaN(arr.getTime())
      ? Math.round(
          (Date.UTC(arr.getFullYear(), arr.getMonth(), arr.getDate()) -
            Date.UTC(dep.getFullYear(), dep.getMonth(), dep.getDate())) /
            86400000
        )
      : 0;

  return (
    <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[150px_1fr]">
      {/* Airline block */}
      <div className="flex items-center gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-md text-sm font-extrabold tracking-tight text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]"
          style={{ backgroundImage: markGradient(airlineCode) }}
        >
          {airlineCode.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-foreground truncate text-sm font-semibold">
            {airlineName}
          </p>
          <p className="text-muted-foreground truncate font-mono text-xs">
            {flightNumbers}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex items-center gap-3">
        <div className="min-w-[56px] text-center">
          <p className="text-foreground text-lg font-bold leading-none tracking-tight tabular-nums">
            {formatTime(first.departAt)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs font-medium">
            {first.from}
          </p>
        </div>
        <div className="relative flex-1 px-1 text-center">
          <p className="text-muted-foreground text-xs font-medium">
            {formatDuration(totalMinutes)}
          </p>
          <div className="bg-border-strong relative my-1.5 h-0.5 rounded">
            {Array.from({ length: stopCount }).map((_, i) => (
              <span
                key={i}
                className="bg-background border-warning absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full border-2"
                style={{ left: `${((i + 1) / (stopCount + 1)) * 100}%` }}
              />
            ))}
            <Plane className="text-muted-foreground bg-background absolute -right-0.5 top-1/2 size-3 -translate-y-1/2 rotate-90" />
          </div>
          <p
            className={cn(
              "text-xs font-semibold",
              stopCount === 0 ? "text-success" : "text-warning"
            )}
          >
            {stopCount === 0
              ? "Direct"
              : `${stopCount} stop${stopCount > 1 ? "s" : ""}${stopVias ? ` · ${stopVias}` : ""}`}
          </p>
        </div>
        <div className="min-w-[56px] text-center">
          <p className="text-foreground text-lg font-bold leading-none tracking-tight tabular-nums">
            {formatTime(last.arriveAt)}
            {dayOffset > 0 && (
              <sup className="text-muted-foreground ml-0.5 text-[10px]">
                +{dayOffset}
              </sup>
            )}
          </p>
          <p className="text-muted-foreground mt-1 text-xs font-medium">
            {last.to}
          </p>
        </div>
      </div>
    </div>
  );
}

function Chip({
  icon: Icon,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="border-border bg-background text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
      {Icon && <Icon className="size-3" />}
      {children}
    </span>
  );
}
