"use client";

import { useState } from "react";
import { Plane, BedDouble, Search, Loader2, Star, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  AddToBookingDialog,
  type BookingOption,
  type ClientOption,
} from "@/components/search/add-to-booking-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
}: {
  bookings: BookingOption[];
  clients: ClientOption[];
  supplierLabel: string;
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
        <FlightSearch bookings={bookings} clients={clients} />
      ) : (
        <HotelSearch bookings={bookings} clients={clients} />
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
}: {
  bookings: BookingOption[];
  clients: ClientOption[];
}) {
  const [form, setForm] = useState({
    origin: "",
    destination: "",
    departDate: "",
    returnDate: "",
    adults: "1",
    cabin: "economy",
    currency: "EUR",
  });
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
      returnDate: form.returnDate || undefined,
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

  const toItem = (o: FlightOffer): BookingItemInput => ({
    type: "flight",
    title: `${o.airlineName}: ${form.origin.toUpperCase()} → ${form.destination.toUpperCase()}`,
    description: `${o.cabin}, ${o.stops === 0 ? "direct" : `${o.stops} stop`}, ${formatDuration(o.durationMinutes)}${form.returnDate ? " (round trip)" : ""}`,
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
          <form onSubmit={run} className="grid grid-cols-2 gap-3 md:grid-cols-7">
            <Field label="From" className="col-span-1">
              <Input
                value={form.origin}
                onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
                placeholder="CDG"
                maxLength={3}
                required
              />
            </Field>
            <Field label="To" className="col-span-1">
              <Input
                value={form.destination}
                onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                placeholder="JFK"
                maxLength={3}
                required
              />
            </Field>
            <Field label="Depart" className="col-span-1">
              <Input
                type="date"
                value={form.departDate}
                onChange={(e) => setForm((f) => ({ ...f, departDate: e.target.value }))}
                required
              />
            </Field>
            <Field label="Return" className="col-span-1">
              <Input
                type="date"
                value={form.returnDate}
                onChange={(e) => setForm((f) => ({ ...f, returnDate: e.target.value }))}
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
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{o.airlineName}</span>
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
                        {o.stops === 0 ? "Direct" : `${o.stops} stop`}
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
}: {
  bookings: BookingOption[];
  clients: ClientOption[];
}) {
  const [form, setForm] = useState({
    city: "",
    cityCode: "",
    checkIn: "",
    checkOut: "",
    adults: "2",
    rooms: "1",
    currency: "EUR",
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<HotelOffer[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNote(null);
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
            <Field label="City" className="col-span-2 md:col-span-1">
              <Input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Marrakech"
                required
              />
            </Field>
            <Field label="City code" className="col-span-1">
              <Input
                value={form.cityCode}
                onChange={(e) => setForm((f) => ({ ...f, cityCode: e.target.value }))}
                placeholder="RAK"
                maxLength={3}
              />
            </Field>
            <Field label="Check-in" className="col-span-1">
              <Input
                type="date"
                value={form.checkIn}
                onChange={(e) => setForm((f) => ({ ...f, checkIn: e.target.value }))}
                required
              />
            </Field>
            <Field label="Check-out" className="col-span-1">
              <Input
                type="date"
                value={form.checkOut}
                onChange={(e) => setForm((f) => ({ ...f, checkOut: e.target.value }))}
                required
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
          {results.length === 0 ? (
            <p className="text-muted-foreground text-sm">No hotels found.</p>
          ) : (
            results.map((o, idx) => (
              <Card key={o.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="hidden size-12 shrink-0 rounded-md sm:block"
                      style={{ backgroundColor: o.thumbnailColor ?? "#64748b" }}
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{o.name}</span>
                        {idx === 0 && (
                          <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-600 dark:text-green-400">
                            Best value
                          </span>
                        )}
                      </div>
                      <div className="text-muted-foreground flex items-center gap-2 text-sm">
                        <span className="flex items-center text-amber-500">
                          {Array.from({ length: o.stars }).map((_, i) => (
                            <Star key={i} className="size-3 fill-current" />
                          ))}
                        </span>
                        <span className="text-xs">
                          {o.boardType} · {o.refundable ? "Refundable" : "Non-refundable"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        {formatMoney(o.priceTotal, o.currency)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatMoney(o.pricePerNight, o.currency)}/night
                      </p>
                    </div>
                    <AddToBookingDialog
                      item={toItem(o)}
                      itemSummary={`${o.name} · ${formatMoney(o.priceTotal, o.currency)} (${o.nights}n from ${formatDate(form.checkIn)})`}
                      bookings={bookings}
                      clients={clients}
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
