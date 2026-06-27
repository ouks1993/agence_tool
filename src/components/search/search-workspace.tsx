"use client";

import { useMemo, useState } from "react";
import { Plane, BedDouble, Search, Loader2, Star, ArrowRight, MapPin, Building2 } from "lucide-react";
import { toast } from "sonner";
import {
  AddToBookingDialog,
  type BookingOption,
  type ClientOption,
} from "@/components/search/add-to-booking-dialog";
import { AirportInput } from "@/components/search/airport-input";
import { HotelDestinationInput } from "@/components/search/hotel-destination-input";
import { HotelDetailsDialog } from "@/components/search/hotel-details-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { BookingItemInput } from "@/lib/actions/bookings";
import { searchFlightsAction, searchHotelsAction } from "@/lib/actions/search";
import { formatMoney, formatDuration, formatTime, formatDate } from "@/lib/format";
import type { FlightOffer, HotelOffer } from "@/lib/suppliers";
import { cn } from "@/lib/utils";

type Tab = "flights" | "hotels";

export function SearchWorkspace({
  bookings,
  clients,
  supplierLabel,
  defaultBookingId,
  defaultDestination,
}: {
  bookings: BookingOption[];
  clients: ClientOption[];
  supplierLabel: string;
  defaultBookingId?: string | undefined;
  defaultDestination?: string | undefined;
}) {
  const [tab, setTab] = useState<Tab>("flights");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <TabButton active={tab === "flights"} onClick={() => setTab("flights")} icon={Plane}>
          Flights
        </TabButton>
        <TabButton active={tab === "hotels"} onClick={() => setTab("hotels")} icon={BedDouble}>
          Hotels
        </TabButton>
        <span className="text-muted-foreground ml-auto text-xs">
          Source: {supplierLabel}
        </span>
      </div>

      {tab === "flights" ? (
        <FlightSearch
          bookings={bookings}
          clients={clients}
          defaultBookingId={defaultBookingId}
        />
      ) : (
        <HotelSearch
          bookings={bookings}
          clients={clients}
          defaultBookingId={defaultBookingId}
          defaultDestination={defaultDestination}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent"
      )}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}

// --- Flights ----------------------------------------------------------------

function FlightSearch({
  bookings,
  clients,
  defaultBookingId,
}: {
  bookings: BookingOption[];
  clients: ClientOption[];
  defaultBookingId?: string | undefined;
}) {
  const [form, setForm] = useState({
    origin: "",
    destination: "",
    departDate: "",
    returnDate: "",
    adults: "1",
    cabin: "economy",
    currency: "DZD",
    tripType: "round" as "round" | "oneway",
  });
  const oneWay = form.tripType === "oneway";
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FlightOffer[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNote(null);
    const res = await searchFlightsAction({
      origin: form.origin,
      destination: form.destination,
      departDate: form.departDate,
      returnDate: oneWay ? undefined : form.returnDate || undefined,
      adults: Number(form.adults),
      cabin: form.cabin as "economy" | "premium" | "business" | "first",
      currency: form.currency,
    });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error ?? "Search failed");
      return;
    }
    setResults(res.results);
    if (res.degraded) setNote("Live supplier unavailable — showing sample data.");
  };

  const flightCodes = (o: FlightOffer): string =>
    o.segments.map((s) => s.flightNumber).join(", ");

  const toItem = (o: FlightOffer): BookingItemInput => ({
    type: "flight",
    title: `${o.airlineName} ${flightCodes(o)}: ${form.origin.toUpperCase()} → ${form.destination.toUpperCase()}`,
    description: `${o.cabin}, ${o.stops === 0 ? "direct" : `${o.stops} stop${o.stops > 1 ? "s" : ""} via ${o.segments.slice(1).map((s) => s.from).join(", ")}`}, ${formatDuration(o.durationMinutes)} (${oneWay ? "one-way" : "round trip"})`,
    supplier: o.airlineName,
    quantity: 1,
    amount: o.priceTotal,
    currency: o.currency,
    startDate: o.segments[0]?.departAt,
    endDate: (o.returnSegments ?? o.segments).at(-1)?.arriveAt,
    details: o,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={!oneWay ? "default" : "outline"}
              onClick={() => setForm((f) => ({ ...f, tripType: "round" }))}
            >
              Round trip
            </Button>
            <Button
              type="button"
              size="sm"
              variant={oneWay ? "default" : "outline"}
              onClick={() => setForm((f) => ({ ...f, tripType: "oneway", returnDate: "" }))}
            >
              One-way
            </Button>
          </div>
          <form onSubmit={run} className="grid grid-cols-2 gap-3 md:grid-cols-7">
            <Field label="From" className="col-span-1">
              <AirportInput
                value={form.origin}
                onChange={(v) => setForm((f) => ({ ...f, origin: v }))}
                placeholder="City or airport"
              />
            </Field>
            <Field label="To" className="col-span-1">
              <AirportInput
                value={form.destination}
                onChange={(v) => setForm((f) => ({ ...f, destination: v }))}
                placeholder="City or airport"
              />
            </Field>
            <Field label="Dates" className="col-span-2 md:col-span-2">
              <DateRangePicker
                startDate={form.departDate}
                endDate={oneWay ? "" : form.returnDate}
                onSelect={(start, end) =>
                  setForm((f) => ({ ...f, departDate: start, returnDate: end }))
                }
                startLabel="Depart"
                endLabel={oneWay ? undefined : "Return"}
              />
            </Field>
            <Field label="Pax" className="col-span-1">
              <Input
                type="number"
                min="1"
                max="9"
                value={form.adults}
                onChange={(e) => setForm((f) => ({ ...f, adults: e.target.value }))}
              />
            </Field>
            <Field label="Cabin" className="col-span-1">
              <Select
                value={form.cabin}
                onChange={(e) => setForm((f) => ({ ...f, cabin: e.target.value }))}
              >
                <option value="economy">Economy</option>
                <option value="premium">Premium</option>
                <option value="business">Business</option>
                <option value="first">First</option>
              </Select>
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
          </form>
        </CardContent>
      </Card>

      {note && <p className="text-muted-foreground text-sm">{note}</p>}

      {results && (
        <div className="space-y-3">
          {results.length === 0 ? (
            <p className="text-muted-foreground text-sm">No flights found.</p>
          ) : (
            results.map((o, idx) => (
              <Card key={o.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{o.airlineName}</span>
                      <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-xs">
                        {o.segments.map((s) => s.flightNumber).join(" · ")}
                      </span>
                      {idx === 0 && (
                        <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-600 dark:text-green-400">
                          Cheapest
                        </span>
                      )}
                      <span className="text-muted-foreground text-xs capitalize">
                        {o.cabin}
                      </span>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <span>{formatTime(o.segments[0]?.departAt)}</span>
                      <span className="font-medium">{o.segments[0]?.from}</span>
                      <ArrowRight className="size-3" />
                      <span className="font-medium">{o.segments.at(-1)?.to}</span>
                      <span>{formatTime(o.segments.at(-1)?.arriveAt)}</span>
                      <span className="text-xs">
                        · {formatDuration(o.durationMinutes)} ·{" "}
                        {o.stops === 0
                          ? "Direct"
                          : `${o.stops} stop${o.stops > 1 ? "s" : ""} via ${o.segments
                              .slice(1)
                              .map((s) => s.from)
                              .join(", ")}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        {formatMoney(o.priceTotal, o.currency)}
                      </p>
                      <p className="text-muted-foreground text-xs">total</p>
                    </div>
                    <AddToBookingDialog
                      item={toItem(o)}
                      itemSummary={`${o.airlineName} · ${formatMoney(o.priceTotal, o.currency)}`}
                      bookings={bookings}
                      clients={clients}
                      defaultBookingId={defaultBookingId}
                      defaultDestination={`${form.origin.toUpperCase()} → ${form.destination.toUpperCase()}`}
                    />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// --- Hotels -----------------------------------------------------------------

function HotelSearch({
  bookings,
  clients,
  defaultBookingId,
  defaultDestination,
}: {
  bookings: BookingOption[];
  clients: ClientOption[];
  defaultBookingId?: string | undefined;
  defaultDestination?: string | undefined;
}) {
  const [form, setForm] = useState({
    // Pre-fill the destination when launched from a booking's search sheet.
    city: defaultDestination ?? "",
    cityCode: "",
    checkIn: "",
    checkOut: "",
    adults: "2",
    rooms: "1",
    currency: "DZD",
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<HotelOffer[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    hotelType: "",
    board: "",
    room: "",
    refundableOnly: false,
  });

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNote(null);
    setFilters({ hotelType: "", board: "", room: "", refundableOnly: false });
    const res = await searchHotelsAction({
      city: form.city,
      cityCode: form.cityCode || undefined,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      adults: Number(form.adults),
      rooms: Number(form.rooms),
      currency: form.currency,
    });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error ?? "Search failed");
      return;
    }
    setResults(res.results);
    if (res.degraded) setNote("Live supplier unavailable — showing sample data.");
  };

  const hotelTypes = useMemo(
    () => [...new Set((results ?? []).map((o) => o.hotelType).filter(Boolean))] as string[],
    [results]
  );
  const boards = useMemo(
    () => [...new Set((results ?? []).map((o) => o.boardType).filter(Boolean))] as string[],
    [results]
  );
  const roomCats = useMemo(
    () => [...new Set((results ?? []).map((o) => roomCategory(o)))].sort(),
    [results]
  );
  const filtered = useMemo(() => {
    if (!results) return null;
    return results.filter(
      (o) =>
        (!filters.hotelType || o.hotelType === filters.hotelType) &&
        (!filters.board || o.boardType === filters.board) &&
        (!filters.room || roomCategory(o) === filters.room) &&
        (!filters.refundableOnly || o.refundable)
    );
  }, [results, filters]);

  const toItem = (o: HotelOffer): BookingItemInput => ({
    type: "hotel",
    title: o.name,
    description: `${o.stars}★ · ${o.boardType ?? "Room only"} · ${o.nights} night${o.nights === 1 ? "" : "s"} · ${o.refundable ? "Refundable" : "Non-refundable"}`,
    supplier: o.name,
    quantity: 1,
    amount: o.priceTotal,
    currency: o.currency,
    startDate: form.checkIn,
    endDate: form.checkOut,
    details: o,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5">
          <form onSubmit={run} className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <Field label="Destination" className="col-span-2">
              <HotelDestinationInput
                value={form.city}
                onChange={(v) => setForm((f) => ({ ...f, city: v, cityCode: "" }))}
                onSelect={(d) => setForm((f) => ({ ...f, city: d.name, cityCode: d.iata }))}
                placeholder="Start typing a city…"
              />
            </Field>
            <Field label="Dates" className="col-span-2 md:col-span-2">
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
            <Field label="Guests" className="col-span-1">
              <Input
                type="number"
                min="1"
                max="9"
                value={form.adults}
                onChange={(e) => setForm((f) => ({ ...f, adults: e.target.value }))}
              />
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
          </form>
        </CardContent>
      </Card>

      {note && <p className="text-muted-foreground text-sm">{note}</p>}

      {results && (
        <div className="space-y-3">
          {results.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect
                label="Hotel type"
                value={filters.hotelType}
                options={hotelTypes}
                onChange={(v) => setFilters((f) => ({ ...f, hotelType: v }))}
              />
              <FilterSelect
                label="Board"
                value={filters.board}
                options={boards}
                onChange={(v) => setFilters((f) => ({ ...f, board: v }))}
              />
              <FilterSelect
                label="Room type"
                value={filters.room}
                options={roomCats}
                onChange={(v) => setFilters((f) => ({ ...f, room: v }))}
              />
              <Button
                type="button"
                size="sm"
                variant={filters.refundableOnly ? "default" : "outline"}
                onClick={() =>
                  setFilters((f) => ({ ...f, refundableOnly: !f.refundableOnly }))
                }
              >
                Refundable
              </Button>
              <span className="text-muted-foreground ml-auto text-xs">
                {filtered?.length ?? 0} of {results.length}
              </span>
            </div>
          )}
          {!filtered || filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {results.length === 0
                ? "No hotels found."
                : "No hotels match these filters."}
            </p>
          ) : (
            filtered.map((o, idx) => (
              <Card key={o.id} className="overflow-hidden">
                <CardContent className="flex gap-4 p-3">
                  {/* Photo */}
                  <div className="bg-muted h-28 w-28 shrink-0 overflow-hidden rounded-md sm:h-32 sm:w-44">
                    {o.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={o.thumbnail}
                        alt={o.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center"
                        style={{ backgroundColor: o.thumbnailColor ?? undefined }}
                      >
                        <BedDouble className="text-muted-foreground size-6" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{o.name}</span>
                      <span className="flex items-center text-amber-500">
                        {Array.from({ length: o.stars }).map((_, i) => (
                          <Star key={i} className="size-3.5 fill-current" />
                        ))}
                      </span>
                      {o.hotelType && (
                        <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
                          <Building2 className="size-3" /> {o.hotelType}
                        </span>
                      )}
                      {idx === 0 && (
                        <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-600 dark:text-green-400">
                          Best value
                        </span>
                      )}
                    </div>
                    {o.city && (
                      <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                        <MapPin className="size-3" /> {o.city}
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
                        {o.refundable ? "Refundable" : "Non-refundable"}
                      </span>
                    </p>
                    {o.hotelCode && (
                      <div className="mt-auto pt-2">
                        <HotelDetailsDialog offer={o} />
                      </div>
                    )}
                  </div>

                  {/* Price + book */}
                  <div className="flex shrink-0 flex-col items-end justify-between gap-2 text-right">
                    <div>
                      <p className="text-lg font-bold">
                        {formatMoney(o.priceTotal, o.currency)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatMoney(o.pricePerNight, o.currency)}/night · {o.nights}n
                      </p>
                    </div>
                    <AddToBookingDialog
                      item={toItem(o)}
                      itemSummary={`${o.name} · ${formatMoney(o.priceTotal, o.currency)} (${o.nights}n from ${formatDate(form.checkIn)})`}
                      bookings={bookings}
                      clients={clients}
                      defaultBookingId={defaultBookingId}
                      defaultDestination={form.city}
                    />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Hotelbeds room-code prefixes → readable room category. */
const ROOM_CATEGORIES: Record<string, string> = {
  SGL: "Single",
  DBL: "Double",
  TWN: "Twin",
  DUI: "Double/Twin",
  TPL: "Triple",
  QUA: "Quadruple",
  SUI: "Suite",
  JST: "Junior Suite",
  FAM: "Family",
  STU: "Studio",
  APT: "Apartment",
  BUN: "Bungalow",
  VIL: "Villa",
  ROO: "Room",
};

function roomCategory(o: HotelOffer): string {
  const prefix = o.roomCode?.split(/[.-]/)[0];
  return (prefix && ROOM_CATEGORIES[prefix]) || "Other";
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-auto text-xs"
    >
      <option value="">{label}: all</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </Select>
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
