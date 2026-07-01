"use client";

import { useMemo, useState } from "react";
import {
  Plane,
  Briefcase,
  Luggage,
  Check,
  Sunrise,
  Sun,
  Sunset,
  Moon,
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import {
  AddToBookingDialog,
  type BookingOption,
  type ClientOption,
} from "@/components/search/add-to-booking-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BookingItemInput } from "@/lib/actions/bookings";
import { formatMoney, formatDuration, formatTime } from "@/lib/format";
import type { FlightOffer, FlightSegment } from "@/lib/suppliers";
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

  const priceRange = useMemo(() => {
    if (results.length === 0) return null;
    const prices = results.map((o) => o.priceTotal);
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [results]);

  // --- Client-side filtering ------------------------------------------------
  const filtered = useMemo(() => {
    return results.filter((o) => {
      if (stops.size && !stops.has(stopBucket(o.stops))) return false;
      if (airlines.size && !airlines.has(o.airlineCode)) return false;
      if (windows.size) {
        const w = windowOf(departHour(o));
        if (!w || !windows.has(w)) return false;
      }
      return true;
    });
  }, [results, stops, airlines, windows]);

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

  const anyFilter = stops.size || airlines.size || windows.size;
  const resetFilters = () => {
    setStops(new Set());
    setAirlines(new Set());
    setWindows(new Set());
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

            {/* Price per traveller (read-only summary from real prices) */}
            {priceRange && adults > 0 && (
              <FilterGroup title="Price per traveller">
                <div className="text-muted-foreground flex items-center justify-between text-xs tabular-nums">
                  <span>{formatMoney(priceRange.min / adults, currency)}</span>
                  <span>{formatMoney(priceRange.max / adults, currency)}</span>
                </div>
                <div className="bg-border relative mt-3 h-1.5 rounded-full">
                  <div className="bg-primary absolute inset-y-0 left-0 right-0 rounded-full" />
                </div>
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
          <div className="space-y-3.5">
            {sorted.map((o) => {
              let ribbon: { label: string; tone: "brand" | "green" | "amber" } | null =
                null;
              if (o.id === bestValueId) ribbon = { label: "Best value", tone: "green" };
              else if (o.id === cheapestId) ribbon = { label: "Cheapest", tone: "green" };
              else if (o.id === businessId)
                ribbon = { label: "Business upgrade", tone: "amber" };
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
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
      />
      <span
        aria-hidden
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input bg-background"
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="text-foreground flex-1 text-sm">{label}</span>
      <span className="text-muted-foreground text-xs tabular-nums">{count}</span>
    </label>
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
        <span className="font-semibold text-green-600 tabular-nums dark:text-green-400">
          {hint}
        </span>
      )}
    </button>
  );
}

// --- Flight card ------------------------------------------------------------

/** Deterministic brand-tinted colour for an airline mark. */
const MARK_COLORS = [
  "bg-[#C8102E]",
  "bg-[#0A6B3B]",
  "bg-[#5C0632]",
  "bg-[#1B4B8F]",
  "bg-[#7C5CE6]",
  "bg-[#B45313]",
];
function markColor(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return MARK_COLORS[h % MARK_COLORS.length]!;
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
  ribbon: { label: string; tone: "brand" | "green" | "amber" } | null;
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
        featured && "ring-primary/40 ring-1"
      )}
    >
      {ribbon && (
        <span
          className={cn(
            "absolute left-0 top-0 z-10 inline-flex items-center gap-1 rounded-br-md px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white",
            ribbon.tone === "green" && "bg-green-600",
            ribbon.tone === "amber" && "bg-amber-500",
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
            <Chip icon={Briefcase}>
              <span className="capitalize">{offer.cabin}</span>
            </Chip>
            <Chip icon={Luggage}>
              {offer.stops === 0
                ? "Direct itinerary"
                : `${offer.stops} stop${offer.stops > 1 ? "s" : ""}`}
            </Chip>
            {fastest && <Chip>Fastest option</Chip>}
          </div>
        </div>

        {/* Price rail */}
        <div className="bg-muted/40 border-border flex flex-col justify-center gap-1 border-t p-5 sm:border-l sm:border-t-0">
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
            <AddToBookingDialog
              item={toItem(offer)}
              itemSummary={summary}
              bookings={bookings}
              clients={clients}
              defaultBookingId={defaultBookingId}
              defaultDestination={routeLabel}
              trigger={
                <Button size="sm" className="w-full">
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
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-md text-sm font-extrabold tracking-tight text-white",
            markColor(airlineCode)
          )}
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
          <div className="bg-border relative my-1.5 h-0.5 rounded">
            {Array.from({ length: stopCount }).map((_, i) => (
              <span
                key={i}
                className="bg-background border-amber-500 absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full border-2"
                style={{ left: `${((i + 1) / (stopCount + 1)) * 100}%` }}
              />
            ))}
            <Plane className="text-muted-foreground bg-background absolute -right-0.5 top-1/2 size-3 -translate-y-1/2 rotate-90" />
          </div>
          <p
            className={cn(
              "text-xs font-semibold",
              stopCount === 0
                ? "text-green-600 dark:text-green-400"
                : "text-amber-600 dark:text-amber-400"
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
