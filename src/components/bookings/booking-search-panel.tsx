"use client";

import { useState, useTransition } from "react";
import {
  Plane,
  BedDouble,
  Search,
  Loader2,
  Star,
  ArrowRight,
  MapPin,
  Building2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { AirportInput } from "@/components/search/airport-input";
import { HotelDestinationInput } from "@/components/search/hotel-destination-input";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { addBookingItem, type BookingItemInput } from "@/lib/actions/bookings";
import { searchFlightsAction, searchHotelsAction } from "@/lib/actions/search";
import { formatMoney, formatDuration, formatTime } from "@/lib/format";
import type { FlightOffer, HotelOffer } from "@/lib/suppliers";
import { cn } from "@/lib/utils";

const DEGRADED_NOTE = "Live supplier unavailable — showing sample data.";

type SubTab = "flights" | "hotels";

/**
 * Embedded live search for the booking detail "Add flight / hotel" dialog.
 * Picking an offer adds it directly to THIS booking via `addBookingItem`, using
 * the SAME offer→BookingItemInput mapping as the standalone Search page so the
 * resulting booking items are indistinguishable from search-page additions.
 */
export function BookingSearchPanel({
  bookingId,
  currency,
  onAdded,
}: {
  bookingId: string;
  currency: string;
  onAdded: () => void;
}) {
  const [subTab, setSubTab] = useState<SubTab>("flights");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={subTab === "flights" ? "default" : "outline"}
          onClick={() => setSubTab("flights")}
        >
          <Plane className="mr-2 size-4" />
          Flights
        </Button>
        <Button
          type="button"
          size="sm"
          variant={subTab === "hotels" ? "default" : "outline"}
          onClick={() => setSubTab("hotels")}
        >
          <BedDouble className="mr-2 size-4" />
          Hotels
        </Button>
      </div>

      {subTab === "flights" ? (
        <FlightSearch bookingId={bookingId} currency={currency} onAdded={onAdded} />
      ) : (
        <HotelSearch bookingId={bookingId} currency={currency} onAdded={onAdded} />
      )}
    </div>
  );
}

// --- Flights ----------------------------------------------------------------

function FlightSearch({
  bookingId,
  currency,
  onAdded,
}: {
  bookingId: string;
  currency: string;
  onAdded: () => void;
}) {
  const [form, setForm] = useState({
    origin: "",
    destination: "",
    departDate: "",
    returnDate: "",
    adults: "1",
    cabin: "economy",
    tripType: "round" as "round" | "oneway",
  });
  const oneWay = form.tripType === "oneway";
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FlightOffer[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNote(null);
    // Price in the booking currency so amounts match the booking total.
    const res = await searchFlightsAction({
      origin: form.origin,
      destination: form.destination,
      departDate: form.departDate,
      returnDate: oneWay ? undefined : form.returnDate || undefined,
      adults: Number(form.adults),
      cabin: form.cabin as "economy" | "premium" | "business" | "first",
      currency,
    });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error ?? "Search failed");
      return;
    }
    setResults(res.results);
    if (res.degraded) setNote(DEGRADED_NOTE);
  };

  const flightCodes = (o: FlightOffer): string =>
    o.segments.map((s) => s.flightNumber).join(", ");

  // Verbatim mapping from search-workspace.tsx so booking items are identical.
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

  const add = (o: FlightOffer) => {
    startAdding(async () => {
      const res = await addBookingItem(bookingId, toItem(o));
      if (res.ok) {
        toast.success("Added");
        onAdded();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={run} className="space-y-3">
        <div className="flex gap-2">
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <AirportInput
              value={form.origin}
              onChange={(v) => setForm((f) => ({ ...f, origin: v }))}
              placeholder="City or airport"
            />
          </Field>
          <Field label="To">
            <AirportInput
              value={form.destination}
              onChange={(v) => setForm((f) => ({ ...f, destination: v }))}
              placeholder="City or airport"
            />
          </Field>
          <Field label="Dates" className="col-span-2">
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
          <Field label="Pax">
            <Input
              type="number"
              min="1"
              max="9"
              value={form.adults}
              onChange={(e) => setForm((f) => ({ ...f, adults: e.target.value }))}
            />
          </Field>
          <Field label="Cabin">
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
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Search className="mr-2 size-4" />
              Search flights
            </>
          )}
        </Button>
      </form>

      {note && <p className="text-muted-foreground text-sm">{note}</p>}

      {results && (
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {results.length === 0 ? (
            <p className="text-muted-foreground text-sm">No flights found.</p>
          ) : (
            results.map((o, idx) => (
              <div
                key={o.id}
                className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
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
                    <span className="text-xs">· {formatDuration(o.durationMinutes)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold">{formatMoney(o.priceTotal, o.currency)}</p>
                    <p className="text-muted-foreground text-xs">total</p>
                  </div>
                  <Button size="sm" onClick={() => add(o)} disabled={adding}>
                    <Plus className="mr-1 size-4" />
                    Add
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// --- Hotels -----------------------------------------------------------------

function HotelSearch({
  bookingId,
  currency,
  onAdded,
}: {
  bookingId: string;
  currency: string;
  onAdded: () => void;
}) {
  const [form, setForm] = useState({
    city: "",
    cityCode: "",
    checkIn: "",
    checkOut: "",
    adults: "2",
    rooms: "1",
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<HotelOffer[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNote(null);
    // Price in the booking currency so amounts match the booking total.
    const res = await searchHotelsAction({
      city: form.city,
      cityCode: form.cityCode || undefined,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      adults: Number(form.adults),
      rooms: Number(form.rooms),
      currency,
    });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error ?? "Search failed");
      return;
    }
    setResults(res.results);
    if (res.degraded) setNote(DEGRADED_NOTE);
  };

  // Verbatim mapping from search-workspace.tsx so booking items are identical.
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

  const add = (o: HotelOffer) => {
    startAdding(async () => {
      const res = await addBookingItem(bookingId, toItem(o));
      if (res.ok) {
        toast.success("Added");
        onAdded();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={run} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Destination" className="col-span-2">
            <HotelDestinationInput
              value={form.city}
              onChange={(v) => setForm((f) => ({ ...f, city: v, cityCode: "" }))}
              onSelect={(d) => setForm((f) => ({ ...f, city: d.name, cityCode: d.iata }))}
              placeholder="Start typing a city…"
            />
          </Field>
          <Field label="Dates" className="col-span-2">
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
          <Field label="Guests">
            <Input
              type="number"
              min="1"
              max="9"
              value={form.adults}
              onChange={(e) => setForm((f) => ({ ...f, adults: e.target.value }))}
            />
          </Field>
          <Field label="Rooms">
            <Input
              type="number"
              min="1"
              max="9"
              value={form.rooms}
              onChange={(e) => setForm((f) => ({ ...f, rooms: e.target.value }))}
            />
          </Field>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Search className="mr-2 size-4" />
              Search hotels
            </>
          )}
        </Button>
      </form>

      {note && <p className="text-muted-foreground text-sm">{note}</p>}

      {results && (
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {results.length === 0 ? (
            <p className="text-muted-foreground text-sm">No hotels found.</p>
          ) : (
            results.map((o, idx) => (
              <div
                key={o.id}
                className="bg-card flex gap-3 overflow-hidden rounded-lg border p-3"
              >
                {/* Photo */}
                <div className="bg-muted h-24 w-24 shrink-0 overflow-hidden rounded-md">
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
                    <span className="truncate font-semibold">{o.name}</span>
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
                  <p className="text-muted-foreground mt-1 text-xs">
                    {o.boardType ?? "Room only"} ·{" "}
                    <span className={o.refundable ? "text-green-600 dark:text-green-400" : ""}>
                      {o.refundable ? "Refundable" : "Non-refundable"}
                    </span>
                  </p>
                </div>

                {/* Price + add */}
                <div className="flex shrink-0 flex-col items-end justify-between gap-2 text-right">
                  <div>
                    <p className="font-bold">{formatMoney(o.priceTotal, o.currency)}</p>
                    <p className="text-muted-foreground text-xs">{o.nights}n</p>
                  </div>
                  <Button size="sm" onClick={() => add(o)} disabled={adding}>
                    <Plus className="mr-1 size-4" />
                    Add
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
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
