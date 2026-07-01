import {
  BedDouble,
  Car,
  MapPin,
  Package,
  Plane,
  Receipt,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import {
  BOOKING_ITEM_TYPE_META,
  type BookingItemType,
} from "@/lib/domain";
import { formatDate, formatDuration, formatMoney, formatTime } from "@/lib/format";
import { statusTone } from "@/lib/status-tone";
import type { FlightOffer, FlightSegment, HotelOffer } from "@/lib/suppliers/types";

/**
 * Rich presentational cards for a booking's flight & hotel lines (deck: Flights /
 * Hotel cards). Every figure is derived from real data:
 *
 *   • Flight route/times/cabin/stops come from the stored `FlightOffer` in
 *     booking_item.details (populated when an offer is added from Search).
 *   • Hotel name/stars/board/nights/room come from the stored `HotelOffer`.
 *
 * When an item has no structured `details` (e.g. a manually-entered line), we
 * fall back to a compact card built from the plain columns (title / supplier /
 * ref / dates) — never fabricating a route or facts that don't exist.
 */

const ICONS: Record<BookingItemType, React.ComponentType<{ className?: string }>> = {
  flight: Plane,
  hotel: BedDouble,
  transfer: Car,
  excursion: Ticket,
  insurance: ShieldCheck,
  fee: Receipt,
  other: Package,
};

const CABIN_LABEL: Record<string, string> = {
  economy: "Economy",
  premium: "Premium",
  business: "Business",
  first: "First",
};

export type BookingSegmentItem = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  supplier: string | null;
  bookingRef: string | null;
  startDate: string | Date | null;
  endDate: string | Date | null;
  quantity: number;
  amount: string;
  currency: string;
  itemStatus: string | null;
  confirmationNumber: string | null;
  details: unknown;
};

/** Narrow the opaque `details` JSON to a FlightOffer if it has flight segments. */
function asFlightOffer(details: unknown): FlightOffer | null {
  if (!details || typeof details !== "object") return null;
  const d = details as Partial<FlightOffer>;
  return Array.isArray(d.segments) && d.segments.length > 0
    ? (d as FlightOffer)
    : null;
}

/** Narrow the opaque `details` JSON to a HotelOffer if it names a property. */
function asHotelOffer(details: unknown): HotelOffer | null {
  if (!details || typeof details !== "object") return null;
  const d = details as Partial<HotelOffer>;
  return typeof d.name === "string" && typeof d.stars === "number"
    ? (d as HotelOffer)
    : null;
}

function ItemStatusBadge({ item }: { item: BookingSegmentItem }) {
  const status = item.confirmationNumber ? "confirmed" : item.itemStatus ?? "pending";
  const label =
    status === "confirmed" || item.confirmationNumber
      ? "Confirmed"
      : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <StatusBadge
      variant={statusTone("bookingItem", status)}
      label={label}
      dot
    />
  );
}

/** A single flight leg (outbound / return): airline mark, 3-col route, facts. */
function FlightLeg({
  segments,
  direction,
  cabin,
  stops,
  durationMinutes,
}: {
  segments: FlightSegment[];
  direction: "Outbound" | "Return";
  cabin: string;
  stops: number;
  durationMinutes: number;
}) {
  const first = segments[0]!;
  const last = segments[segments.length - 1]!;
  const carrierName = first.carrierName || first.carrierCode;
  const flightNumbers = segments
    .map((s) => `${s.carrierCode} ${s.flightNumber}`)
    .join(" → ");
  const stopLabel =
    stops <= 0
      ? "Direct"
      : `${stops} stop${stops > 1 ? "s" : ""}${
          segments.length > 1
            ? ` · ${segments
                .slice(0, -1)
                .map((s) => s.to)
                .join(", ")}`
            : ""
        }`;

  return (
    <div className="border-border border-b py-4 first:pt-0 last:border-0 last:pb-0">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span
          className="bg-primary flex size-8 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-primary-foreground uppercase"
          aria-hidden
        >
          {first.carrierCode}
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold">
            {carrierName}
            <span className="text-muted-foreground font-normal">
              {" "}
              · {flightNumbers}
            </span>
          </p>
          <p className="text-muted-foreground text-xs">
            {direction}
            {first.departAt ? ` · ${formatDate(first.departAt)}` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="dep">
          <div className="text-2xl font-bold tracking-tight tabular-nums">
            {first.from}
          </div>
          <div className="mt-0.5 text-[13px] font-medium tabular-nums">
            {formatTime(first.departAt)}
          </div>
        </div>

        <div className="flex min-w-[96px] flex-col items-center gap-1">
          <span className="text-muted-foreground text-[11px] tabular-nums">
            {formatDuration(durationMinutes)}
          </span>
          <span className="text-border-strong flex w-full items-center gap-1">
            <span className="bg-border-strong h-0.5 flex-1 rounded-full" />
            <Plane className="text-primary size-4 shrink-0 rotate-90" aria-hidden />
            <span className="bg-border-strong h-0.5 flex-1 rounded-full" />
          </span>
          <span className="text-muted-foreground text-[10.5px]">{stopLabel}</span>
        </div>

        <div className="arr text-right">
          <div className="text-2xl font-bold tracking-tight tabular-nums">
            {last.to}
          </div>
          <div className="mt-0.5 text-[13px] font-medium tabular-nums">
            {formatTime(last.arriveAt)}
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <Fact k="Cabin" v={CABIN_LABEL[cabin] ?? cabin} />
        <Fact k="Stops" v={stops <= 0 ? "Direct" : String(stops)} />
        <Fact k="Duration" v={formatDuration(durationMinutes)} />
      </div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <span className="text-muted-foreground text-[11.5px]">
      {k}{" "}
      <span className="text-foreground font-medium tabular-nums">{v}</span>
    </span>
  );
}

function FlightItemCard({ item }: { item: BookingSegmentItem }) {
  const offer = asFlightOffer(item.details);
  const line = parseFloat(item.amount || "0") * item.quantity;

  // Structured offer → full deck itinerary; else compact fallback card.
  if (!offer) return <FallbackItemCard item={item} />;

  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <Plane className="text-primary size-4 shrink-0" aria-hidden />
            Flight
            <span className="text-muted-foreground text-xs font-normal">
              {offer.airlineName || offer.airlineCode}
              {item.bookingRef ? ` · PNR ${item.bookingRef}` : ""}
              {offer.cabin ? ` · ${CABIN_LABEL[offer.cabin] ?? offer.cabin}` : ""}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <ItemStatusBadge item={item} />
          <span className="font-semibold tabular-nums">
            {formatMoney(line, item.currency)}
          </span>
        </div>
      </div>

      <FlightLeg
        segments={offer.segments}
        direction="Outbound"
        cabin={offer.cabin}
        stops={offer.stops}
        durationMinutes={offer.durationMinutes}
      />
      {offer.returnSegments && offer.returnSegments.length > 0 && (
        <FlightLeg
          segments={offer.returnSegments}
          direction="Return"
          cabin={offer.cabin}
          stops={Math.max(0, offer.returnSegments.length - 1)}
          durationMinutes={offer.returnSegments.reduce(
            (s, seg) => s + (seg.durationMinutes || 0),
            0
          )}
        />
      )}
    </div>
  );
}

function HotelItemCard({ item }: { item: BookingSegmentItem }) {
  const offer = asHotelOffer(item.details);
  const line = parseFloat(item.amount || "0") * item.quantity;

  if (!offer) return <FallbackItemCard item={item} />;

  const checkIn = item.startDate ?? null;
  const checkOut = item.endDate ?? null;
  const stars = Math.max(0, Math.min(5, Math.round(offer.stars)));

  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-[15px] font-semibold">
          <BedDouble className="text-primary size-4 shrink-0" aria-hidden />
          Hotel
          {item.supplier && (
            <span className="text-muted-foreground text-xs font-normal">
              via {item.supplier}
              {item.bookingRef ? ` · ${item.bookingRef}` : ""}
            </span>
          )}
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <ItemStatusBadge item={item} />
          <span className="font-semibold tabular-nums">
            {formatMoney(line, item.currency)}
          </span>
        </div>
      </div>

      <div className="flex gap-4">
        <div
          className="from-chart-1 to-chart-5 relative flex size-24 shrink-0 items-end overflow-hidden rounded-lg bg-gradient-to-br p-2"
          aria-hidden
        >
          {stars > 0 && (
            <span className="relative z-10 inline-flex items-center gap-0.5 rounded-full bg-black/30 px-2 py-0.5 text-[11px] font-bold text-white">
              {"★".repeat(stars)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold tracking-tight">{offer.name}</p>
          {(offer.address || offer.city) && (
            <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                {offer.address ? offer.address : offer.city}
              </span>
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {checkIn && <HotelFact k="Check-in" v={formatDate(checkIn)} />}
            {checkOut && <HotelFact k="Check-out" v={formatDate(checkOut)} />}
            {offer.nights > 0 && (
              <HotelFact k="Nights" v={String(offer.nights)} />
            )}
            {offer.boardType && <HotelFact k="Board" v={offer.boardType} />}
            {offer.roomName && (
              <HotelFact
                k="Room"
                v={
                  item.quantity > 1
                    ? `${item.quantity} × ${offer.roomName}`
                    : offer.roomName
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HotelFact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        {k}
      </div>
      <div className="mt-0.5 text-[13.5px] font-semibold tabular-nums">{v}</div>
    </div>
  );
}

/** Compact card for items with no structured offer (manual / transfers). */
function FallbackItemCard({ item }: { item: BookingSegmentItem }) {
  const Icon = ICONS[item.type as BookingItemType] ?? Package;
  const line = parseFloat(item.amount || "0") * item.quantity;
  const typeLabel =
    BOOKING_ITEM_TYPE_META[item.type as BookingItemType]?.label ?? item.type;
  const meta = [
    item.supplier,
    item.bookingRef,
    item.quantity > 1 ? `×${item.quantity}` : null,
    item.startDate ? formatDate(item.startDate) : null,
  ].filter(Boolean);

  return (
    <div className="border-border bg-card flex items-start gap-3 rounded-lg border p-4">
      <div className="bg-accent text-accent-foreground mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md">
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{item.title}</p>
        <p className="text-muted-foreground text-xs">
          {typeLabel}
          {meta.length > 0 ? ` · ${meta.join(" · ")}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <ItemStatusBadge item={item} />
        <span className="font-semibold tabular-nums">
          {formatMoney(line, item.currency)}
        </span>
      </div>
    </div>
  );
}

/** Dispatch by item type. */
export function BookingSegmentCard({ item }: { item: BookingSegmentItem }) {
  if (item.type === "flight") return <FlightItemCard item={item} />;
  if (item.type === "hotel") return <HotelItemCard item={item} />;
  return <FallbackItemCard item={item} />;
}
