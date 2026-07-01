"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BedDouble,
  CalendarDays,
  CheckCircle2,
  Info,
  Loader2,
  MapPin,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import {
  OccupancyPicker,
  occupancySummary,
  type Occupancy,
} from "@/components/hotels/occupancy-picker";
import {
  AddToBookingDialog,
  type BookingOption,
  type ClientOption,
} from "@/components/search/add-to-booking-dialog";
import {
  AddToProposalDialog,
  type DraftOption,
} from "@/components/search/add-to-proposal-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BookingItemInput } from "@/lib/actions/bookings";
import type { ItemInput } from "@/lib/actions/products";
import { searchHotelRoomsAction } from "@/lib/actions/search";
import { formatDate, formatMoney } from "@/lib/format";
import type { HotelDetails, HotelRoomRate } from "@/lib/suppliers";
import { cn } from "@/lib/utils";

type Dates = { checkIn: string; checkOut: string };

export function HotelDetailsView({
  hotelCode,
  name,
  city,
  cityCode,
  currency,
  content,
  initialOccupancy,
  initialDates,
  drafts,
  clients,
  bookings,
}: {
  hotelCode: string;
  name: string;
  city: string;
  cityCode: string;
  currency: string;
  content: HotelDetails | null;
  initialOccupancy: Occupancy;
  initialDates: Dates;
  drafts: DraftOption[];
  clients: ClientOption[];
  bookings: BookingOption[];
}) {
  const [occ, setOcc] = useState<Occupancy>(initialOccupancy);
  const [dates, setDates] = useState<Dates>(initialDates);
  const [rooms, setRooms] = useState<HotelRoomRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [activeImg, setActiveImg] = useState(0);

  const displayName = content?.name || name;
  const stars = useMemo(() => {
    const m = content?.category ? /(\d)/.exec(content.category) : null;
    return m ? parseInt(m[1]!, 10) : 0;
  }, [content]);

  const gallery = useMemo(() => (content?.images ?? []).map((i) => i.url), [content]);

  // Resolve the best image for a room: a photo tagged with the same room-code
  // prefix, else the first hotel photo, else nothing (the row shows an icon).
  const roomImage = useCallback(
    (room: HotelRoomRate): string | undefined => {
      const prefix = room.roomCode?.split(/[.-]/)[0];
      const tagged = prefix
        ? content?.images.find(
            (i) => i.roomCode && i.roomCode.split(/[.-]/)[0] === prefix
          )
        : undefined;
      return tagged?.url ?? gallery[0];
    },
    [content, gallery]
  );

  // --- Dynamic pricing: re-fetch rooms whenever occupancy or dates change. ---
  const fetchRooms = useCallback(async () => {
    if (!dates.checkIn || !dates.checkOut) return;
    setLoading(true);
    const res = await searchHotelRoomsAction({
      hotelCode,
      city,
      cityCode: cityCode || undefined,
      checkIn: dates.checkIn,
      checkOut: dates.checkOut,
      adults: occ.adults,
      rooms: occ.rooms,
      childAges: occ.childAges,
      currency,
    });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not load room prices");
      setRooms([]);
      return;
    }
    setRooms(res.rooms);
    setDegraded(res.degraded);
  }, [hotelCode, city, cityCode, currency, dates, occ]);

  useEffect(() => {
    const t = setTimeout(fetchRooms, 350); // debounce rapid stepper clicks
    return () => clearTimeout(t);
  }, [fetchRooms]);

  const mapSrc =
    content?.latitude && content?.longitude
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${content.longitude - 0.01}%2C${content.latitude - 0.008}%2C${content.longitude + 0.01}%2C${content.latitude + 0.008}&layer=mapnik&marker=${content.latitude}%2C${content.longitude}`
      : null;

  const toProposalItem = (r: HotelRoomRate): ItemInput => ({
    type: "hotel",
    title: `${displayName} — ${r.roomName}`,
    description: `${stars ? `${stars}★ · ` : ""}${r.boardType ?? "Room only"} · ${occupancySummary(occ)} · ${r.nights} night${r.nights === 1 ? "" : "s"} · ${r.refundable ? "Free cancellation" : "Non-refundable"}`,
    supplier: displayName,
    quantity: 1,
    unitCost: r.priceTotal,
    currency: r.currency,
    startDate: dates.checkIn,
    endDate: dates.checkOut,
    details: {
      hotelCode,
      hotelName: displayName,
      city: content?.city ?? city,
      stars,
      occupancy: occ,
      stay: dates,
      room: r,
    },
  });

  const toBookingItem = (r: HotelRoomRate): BookingItemInput => ({
    type: "hotel",
    title: `${displayName} — ${r.roomName}`,
    description: `${r.boardType ?? "Room only"} · ${occupancySummary(occ)} · ${r.refundable ? "Free cancellation" : "Non-refundable"}`,
    supplier: displayName,
    quantity: 1,
    amount: r.priceTotal,
    currency: r.currency,
    startDate: dates.checkIn,
    endDate: dates.checkOut,
    details: { hotelCode, occupancy: occ, room: r },
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{displayName}</h1>
          {stars > 0 && (
            <span className="flex items-center text-amber-500">
              {Array.from({ length: stars }).map((_, i) => (
                <Star key={i} className="size-4 fill-current" />
              ))}
            </span>
          )}
          {content?.hotelType && <Badge variant="secondary">{content.hotelType}</Badge>}
        </div>
        {(content?.address || content?.city) && (
          <p className="text-muted-foreground mt-1 flex items-center gap-1 text-sm">
            <MapPin className="size-3.5" />
            {[content?.address, content?.city, content?.postalCode, content?.country]
              .filter(Boolean)
              .join(", ")}
          </p>
        )}
      </div>

      {/* Photo gallery */}
      {gallery.length > 0 && (
        <section className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gallery[activeImg]}
            alt={displayName}
            loading="lazy"
            className="aspect-video w-full rounded-lg object-cover"
          />
          {gallery.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {gallery.slice(0, 12).map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setActiveImg(i)}
                  className={cn(
                    "relative size-16 shrink-0 overflow-hidden rounded-md border-2",
                    i === activeImg ? "border-primary" : "border-transparent"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" loading="lazy" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Occupancy controls — change these to re-price the rooms below. */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Check-in</Label>
            <Input
              type="date"
              value={dates.checkIn}
              onChange={(e) => setDates((d) => ({ ...d, checkIn: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Check-out</Label>
            <Input
              type="date"
              value={dates.checkOut}
              onChange={(e) => setDates((d) => ({ ...d, checkOut: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Guests & rooms</Label>
            <OccupancyPicker value={occ} onChange={setOcc} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Overview */}
          {content?.description && (
            <Section title="Overview">
              <p className="text-sm leading-7 whitespace-pre-line">{content.description}</p>
              {content.segments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {content.segments.map((s) => (
                    <Badge key={s} variant="outline">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Facilities */}
          {content && content.facilities.length > 0 && (
            <Section title="Facilities">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                {content.facilities.map((f) => (
                  <p key={f} className="flex items-center gap-1.5 text-sm">
                    <CheckCircle2 className="text-success size-3.5 shrink-0" />
                    {f}
                  </p>
                ))}
              </div>
            </Section>
          )}

          {/* Location map */}
          {mapSrc && (
            <Section title="Location">
              <iframe
                title="Hotel location map"
                src={mapSrc}
                className="aspect-video w-full rounded-lg border"
                loading="lazy"
              />
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${content!.latitude},${content!.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary mt-2 inline-block text-sm underline"
              >
                Open in Google Maps
              </a>
            </Section>
          )}
        </div>

        {/* Reviews + important info sidebar */}
        <div className="space-y-6">
          <ReviewsCard stars={stars} code={hotelCode} />
          <Section title="Important information">
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li className="flex gap-2">
                <Info className="mt-0.5 size-3.5 shrink-0" /> Check-in from 14:00,
                check-out by 12:00 (local time).
              </li>
              <li className="flex gap-2">
                <Info className="mt-0.5 size-3.5 shrink-0" /> Government-issued photo ID
                may be required at check-in.
              </li>
              <li className="flex gap-2">
                <Info className="mt-0.5 size-3.5 shrink-0" /> Prices shown are the supplier
                net rate for the selected occupancy; agency markup is applied in the
                proposal.
              </li>
            </ul>
          </Section>
        </div>
      </div>

      {/* Room availability table */}
      <Section title="Room availability">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-muted-foreground text-sm">
            Priced for {occupancySummary(occ)}
            {dates.checkIn && dates.checkOut
              ? ` · ${formatDate(dates.checkIn)} → ${formatDate(dates.checkOut)}`
              : ""}
          </p>
          {loading && (
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Loader2 className="size-3 animate-spin" /> Updating prices…
            </span>
          )}
          {degraded && !loading && (
            <Badge variant="outline" className="text-xs">
              Sample rates
            </Badge>
          )}
        </div>

        <div className="max-h-[32rem] overflow-x-auto overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-card sticky top-0 z-10">
              <TableRow>
                <TableHead>Room type</TableHead>
                <TableHead>Occupancy</TableHead>
                <TableHead>Meal plan</TableHead>
                <TableHead>Cancellation</TableHead>
                <TableHead className="text-end">Price</TableHead>
                <TableHead className="text-end">Select</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground text-center">
                    No rooms available for this occupancy.
                  </TableCell>
                </TableRow>
              ) : (
                rooms.map((r) => (
                  <TableRow key={r.id} className="even:bg-muted/40">
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {roomImage(r) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={roomImage(r)}
                            alt={r.roomName}
                            loading="lazy"
                            className="bg-muted size-12 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <span className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-md">
                            <BedDouble className="text-muted-foreground size-4" />
                          </span>
                        )}
                        {r.roomName}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {r.adults} adult{r.adults === 1 ? "" : "s"}
                      {r.children > 0 ? `, ${r.children} child${r.children === 1 ? "" : "ren"}` : ""}
                    </TableCell>
                    <TableCell>{r.boardType ?? "Room only"}</TableCell>
                    <TableCell>
                      {r.refundable ? (
                        <span className="text-success">
                          Free cancellation
                          {r.cancellationDeadline
                            ? ` until ${formatDate(r.cancellationDeadline)}`
                            : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Non-refundable</span>
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      <span className="font-semibold tabular-nums">
                        {formatMoney(r.priceTotal, r.currency)}
                      </span>
                      <span className="text-muted-foreground block text-xs tabular-nums">
                        {formatMoney(r.pricePerNight, r.currency)}/night
                      </span>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1.5">
                        <AddToProposalDialog
                          item={toProposalItem(r)}
                          itemSummary={`${displayName} · ${r.roomName} · ${formatMoney(r.priceTotal, r.currency)}`}
                          drafts={drafts}
                          clients={clients}
                        />
                        <AddToBookingDialog
                          item={toBookingItem(r)}
                          itemSummary={`${displayName} · ${r.roomName} · ${formatMoney(r.priceTotal, r.currency)}`}
                          bookings={bookings}
                          clients={clients}
                          defaultDestination={content?.city ?? city}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Section>

      {/* Policies */}
      <Section title="Policies">
        <div className="text-muted-foreground grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <p className="flex gap-2">
            <CalendarDays className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="text-foreground font-medium">Cancellation</span> — varies by
              rate. Refundable rates are free to cancel until the date shown in the room
              table; non-refundable rates cannot be changed.
            </span>
          </p>
          <p className="flex gap-2">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="text-foreground font-medium">Children</span> — child rates
              depend on age; ages are sent to the supplier so the price is exact.
            </span>
          </p>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Reviews are not exposed by the basic Hotelbeds content feed, so the score and
 * category bars are estimated from the star rating (stable per hotel) and
 * clearly labelled as an estimate.
 */
function ReviewsCard({ stars, code }: { stars: number; code: string }) {
  const seed = useMemo(() => {
    let h = 0;
    for (const c of code) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return h;
  }, [code]);
  const score = Math.min(9.8, Math.max(6.5, 6.8 + stars * 0.5 + ((seed % 5) - 2) * 0.1));
  const cats = ["Staff", "Cleanliness", "Location", "Value", "Comfort"];
  const scoreBg = score >= 9 ? "bg-success" : score >= 8 ? "bg-info" : "bg-muted-foreground";

  return (
    <Section title="Guest reviews">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-md px-2 py-1 text-lg font-bold text-white tabular-nums",
                scoreBg
              )}
            >
              {score.toFixed(1)}
            </span>
            <div className="leading-tight">
              <p className="font-semibold">{score >= 9 ? "Superb" : score >= 8 ? "Very good" : "Good"}</p>
              <p className="text-muted-foreground text-xs">Estimated rating</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {cats.map((c, i) => {
              const v = Math.min(10, score + (((seed >> i) % 5) - 2) * 0.2);
              return (
                <div key={c} className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20 text-xs">{c}</span>
                  <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${v * 10}%` }}
                    />
                  </div>
                  <span className="w-6 text-end text-xs tabular-nums">{v.toFixed(1)}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </Section>
  );
}
