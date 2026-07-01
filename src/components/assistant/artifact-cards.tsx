"use client";

/**
 * Generative ARTIFACT cards for the AI assistant.
 *
 * These render the *structured* results the assistant actually produces via its
 * tools (src/app/api/chat/route.ts): flight search, hotel search, a bookings
 * summary, and a created-booking confirmation. We deliberately only build cards
 * for tool outputs that exist — no fabricated itinerary/email artifacts.
 *
 * All money is formatted with formatMoney() using the currency each offer/tool
 * returns; we never sum across currencies. Numeric figures carry `.tabular-nums`.
 */

import Link from "next/link";
import {
  ArrowUpRight,
  Bot,
  Building2,
  CheckCircle2,
  Coins,
  ExternalLink,
  Plane,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDuration, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- shells -- */

function CardShell({
  icon: Icon,
  title,
  subtitle,
  badge,
  children,
  footer,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string | undefined;
  badge?: React.ReactNode | undefined;
  children: React.ReactNode;
  footer?: React.ReactNode | undefined;
}) {
  return (
    <div className="bg-card border-border mt-2 overflow-hidden rounded-lg border shadow-md">
      <div className="bg-surface-2 border-border flex items-center gap-3 border-b px-4 py-3">
        <span className="bg-brand/10 text-brand flex size-8 shrink-0 items-center justify-center rounded-md">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-semibold tracking-tight">
            {title}
          </p>
          {subtitle && (
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              {subtitle}
            </p>
          )}
        </div>
        {badge}
      </div>
      {children}
      {footer && (
        <div className="bg-surface-2 border-border flex flex-wrap items-center gap-2 border-t px-4 py-3">
          {footer}
        </div>
      )}
    </div>
  );
}

function MetaNote({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground ml-auto flex items-center gap-1.5 text-[11px]">
      <Bot className="size-3.5" />
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- flights -- */

type FlightOfferRow = {
  airline?: string;
  price?: number;
  currency?: string;
  cabin?: string;
  stops?: number;
  durationMinutes?: number;
};

export type FlightSearchOutput = {
  ok?: boolean;
  source?: string;
  degraded?: boolean;
  offers?: FlightOfferRow[];
  error?: string;
};

export function FlightResultsCard({ data }: { data: FlightSearchOutput }) {
  if (!data?.ok) return <ToolError message={data?.error} />;
  const offers = data.offers ?? [];
  if (offers.length === 0)
    return <ToolEmpty message="No flights matched that search." />;

  // Cheapest first; flag the best value. Prices already share a currency (EUR).
  const sorted = [...offers].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));

  return (
    <CardShell
      icon={Plane}
      title={`${offers.length} flight ${offers.length === 1 ? "option" : "options"}`}
      subtitle="Sorted by price · best value highlighted"
      badge={<SourceBadge source={data.source} degraded={data.degraded} />}
      footer={
        <MetaNote>
          {data.degraded
            ? "Indicative sample fares · confirm live before booking"
            : "Live supplier fares · review before booking"}
        </MetaNote>
      }
    >
      <ul className="divide-border divide-y">
        {sorted.map((o, i) => (
          <li
            key={i}
            className="flex items-center gap-3 px-4 py-3"
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
                i === 0
                  ? "bg-success-soft text-success"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Plane className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-foreground truncate text-sm font-medium">
                  {o.airline ?? "Flight"}
                </p>
                {i === 0 && (
                  <Badge variant="success" className="h-5 px-1.5 text-[10px]">
                    Best value
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                {o.cabin && <span className="capitalize">{o.cabin}</span>}
                <span aria-hidden>·</span>
                <span>
                  {o.stops === 0
                    ? "Direct"
                    : `${o.stops ?? 0} stop${(o.stops ?? 0) === 1 ? "" : "s"}`}
                </span>
                {typeof o.durationMinutes === "number" && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">
                      {formatDuration(o.durationMinutes)}
                    </span>
                  </>
                )}
              </p>
            </div>
            <p className="text-foreground shrink-0 text-sm font-semibold tabular-nums">
              {formatMoney(o.price, o.currency)}
            </p>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

/* ---------------------------------------------------------------- hotels -- */

type HotelOfferRow = {
  name?: string;
  stars?: number;
  pricePerNight?: number;
  priceTotal?: number;
  currency?: string;
  board?: string;
  nights?: number;
};

export type HotelSearchOutput = {
  ok?: boolean;
  source?: string;
  degraded?: boolean;
  hotels?: HotelOfferRow[];
  error?: string;
};

export function HotelResultsCard({ data }: { data: HotelSearchOutput }) {
  if (!data?.ok) return <ToolError message={data?.error} />;
  const hotels = data.hotels ?? [];
  if (hotels.length === 0)
    return <ToolEmpty message="No hotels matched that search." />;

  const sorted = [...hotels].sort(
    (a, b) => (a.priceTotal ?? 0) - (b.priceTotal ?? 0)
  );

  return (
    <CardShell
      icon={Building2}
      title={`${hotels.length} hotel ${hotels.length === 1 ? "option" : "options"}`}
      subtitle="Sorted by total price"
      badge={<SourceBadge source={data.source} degraded={data.degraded} />}
      footer={
        <MetaNote>
          {data.degraded
            ? "Indicative sample rates · confirm live before booking"
            : "Live supplier rates · review before booking"}
        </MetaNote>
      }
    >
      <ul className="divide-border divide-y">
        {sorted.map((h, i) => (
          <li key={i} className="flex items-start gap-3 px-4 py-3">
            <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
              <Building2 className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-sm font-medium">
                {h.name ?? "Hotel"}
              </p>
              <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                {typeof h.stars === "number" && (
                  <span className="text-warning inline-flex items-center gap-0.5">
                    <Star className="size-3 fill-current" />
                    <span className="tabular-nums">{h.stars}</span>
                  </span>
                )}
                {h.board && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="capitalize">{h.board}</span>
                  </>
                )}
                {typeof h.nights === "number" && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">
                      {h.nights} night{h.nights === 1 ? "" : "s"}
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-foreground text-sm font-semibold tabular-nums">
                {formatMoney(h.priceTotal, h.currency)}
              </p>
              {typeof h.pricePerNight === "number" && (
                <p className="text-muted-foreground text-[11px] tabular-nums">
                  {formatMoney(h.pricePerNight, h.currency)}/night
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

/* ------------------------------------------------------- bookings summary -- */

export type BookingsSummaryOutput = {
  ok?: boolean;
  totalBookings?: number;
  byStatus?: Record<string, number>;
  activeValue?: number;
  currency?: string;
  error?: string;
};

export function BookingSummaryCard({ data }: { data: BookingsSummaryOutput }) {
  if (!data?.ok) return <ToolError message={data?.error} />;
  const byStatus = data.byStatus ?? {};
  const statuses = Object.entries(byStatus);

  return (
    <CardShell
      icon={Coins}
      title="Bookings summary"
      subtitle="Across your agency"
    >
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-2">
        <div className="bg-card px-4 py-3">
          <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
            Total bookings
          </p>
          <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">
            {data.totalBookings ?? 0}
          </p>
        </div>
        <div className="bg-card px-4 py-3">
          <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
            Active value
          </p>
          <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">
            {formatMoney(data.activeValue ?? 0, data.currency)}
          </p>
        </div>
      </div>
      {statuses.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {statuses.map(([status, count]) => (
            <span
              key={status}
              className="border-border bg-secondary text-secondary-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
            >
              <span className="capitalize">{status}</span>
              <span className="text-muted-foreground tabular-nums">
                {count}
              </span>
            </span>
          ))}
        </div>
      )}
    </CardShell>
  );
}

/* -------------------------------------------------------- booking created -- */

export type BookingCreatedOutput = {
  ok?: boolean;
  bookingId?: string;
  url?: string;
  failedTravellers?: string[];
  failedItems?: string[];
  message?: string;
  error?: string;
};

export function BookingCreatedCard({ data }: { data: BookingCreatedOutput }) {
  if (!data?.ok) return <ToolError message={data?.error} />;
  const hadFailures =
    (data.failedTravellers?.length ?? 0) > 0 ||
    (data.failedItems?.length ?? 0) > 0;

  return (
    <CardShell
      icon={CheckCircle2}
      title="Booking file created"
      subtitle={data.bookingId ? `Ref ${data.bookingId}` : undefined}
      badge={
        <Badge variant={hadFailures ? "warning" : "success"} dot>
          {hadFailures ? "Needs review" : "Created"}
        </Badge>
      }
      footer={
        data.url ? (
          <Button asChild size="sm">
            <Link href={data.url}>
              <ExternalLink className="size-4" />
              Open booking
            </Link>
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-3 px-4 py-3">
        {data.message && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {data.message}
          </p>
        )}
        {hadFailures && (
          <div className="bg-warning-soft border-warning/30 rounded-md border p-3 text-xs leading-relaxed">
            {(data.failedTravellers?.length ?? 0) > 0 && (
              <p className="text-warning">
                Could not add travellers:{" "}
                <span className="text-foreground font-medium">
                  {data.failedTravellers!.join(", ")}
                </span>
              </p>
            )}
            {(data.failedItems?.length ?? 0) > 0 && (
              <p className="text-warning mt-1">
                Could not add items:{" "}
                <span className="text-foreground font-medium">
                  {data.failedItems!.join(", ")}
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </CardShell>
  );
}

/* -------------------------------------------------------------- clients --- */

type ClientRow = { id?: string; name?: string; email?: string | null };

export type FindClientsOutput = {
  ok?: boolean;
  clients?: ClientRow[];
  error?: string;
};

export function ClientsCard({ data }: { data: FindClientsOutput }) {
  if (!data?.ok) return <ToolError message={data?.error} />;
  const clients = data.clients ?? [];
  if (clients.length === 0)
    return <ToolEmpty message="No matching clients in your CRM." />;

  return (
    <CardShell
      icon={Building2}
      title={`${clients.length} client${clients.length === 1 ? "" : "s"}`}
      subtitle="From your agency CRM"
    >
      <ul className="divide-border divide-y">
        {clients.map((c, i) => {
          const row = (
            <>
              <span className="bg-brand/10 text-brand flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
                {(c.name ?? "?").slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-medium">
                  {c.name ?? "Client"}
                </p>
                {c.email && (
                  <p className="text-muted-foreground truncate text-xs">
                    {c.email}
                  </p>
                )}
              </div>
              {c.id && (
                <ArrowUpRight className="text-muted-foreground size-4 shrink-0" />
              )}
            </>
          );
          return c.id ? (
            <li key={c.id}>
              <Link
                href={`/clients/${c.id}`}
                className="hover:bg-accent flex items-center gap-3 px-4 py-3 transition-colors"
              >
                {row}
              </Link>
            </li>
          ) : (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              {row}
            </li>
          );
        })}
      </ul>
    </CardShell>
  );
}

/* ---------------------------------------------------------------- shared -- */

function SourceBadge({
  source,
  degraded,
}: {
  source?: string | undefined;
  degraded?: boolean | undefined;
}) {
  if (degraded) {
    return (
      <Badge variant="warning" className="h-5 px-2 text-[10px]">
        Sample data
      </Badge>
    );
  }
  return (
    <Badge variant="info" dot className="h-5 px-2 text-[10px]">
      {source ? `Live · ${source}` : "Live"}
    </Badge>
  );
}

function ToolError({ message }: { message?: string | undefined }) {
  return (
    <div className="bg-destructive/10 border-destructive/20 text-destructive mt-2 rounded-lg border p-3 text-sm">
      {message || "That request could not be completed. Please try again."}
    </div>
  );
}

function ToolEmpty({ message }: { message: string }) {
  return (
    <div className="bg-muted/40 border-border text-muted-foreground mt-2 rounded-lg border border-dashed p-3 text-sm">
      {message}
    </div>
  );
}

/* ----------------------------------------------------------- dispatcher --- */

/**
 * Renders the right artifact card for a resolved tool part, or null if this
 * tool has no dedicated card. `toolName` is the tool key (without the
 * `tool-` prefix that AI SDK adds to the part type).
 */
export function ToolArtifact({
  toolName,
  output,
}: {
  toolName: string;
  output: unknown;
}) {
  switch (toolName) {
    case "searchFlights":
      return <FlightResultsCard data={output as FlightSearchOutput} />;
    case "searchHotels":
      return <HotelResultsCard data={output as HotelSearchOutput} />;
    case "bookingsSummary":
      return <BookingSummaryCard data={output as BookingsSummaryOutput} />;
    case "createBooking":
      return <BookingCreatedCard data={output as BookingCreatedOutput} />;
    case "findClients":
      return <ClientsCard data={output as FindClientsOutput} />;
    default:
      return null;
  }
}
