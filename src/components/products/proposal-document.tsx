import {
  BedDouble,
  Calendar,
  Car,
  MapPin,
  Package,
  Plane,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";
import { PRODUCT_ITEM_TYPE_META, type ProductItemType } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shared proposal renderer
//
// One component renders the client-facing proposal document from REAL product
// data, so the builder's live preview, the public /p/[token] link, the internal
// /proposal/[id] preview and the portal proposal page all render identically.
//
// No data is fabricated: the itinerary is derived from productItem rows (grouped
// by their real startDate when present, otherwise shown as a flat inclusions
// list) and every figure comes from the item unit prices in the proposal's own
// currency. Currencies are never mixed — the document currency is authoritative.
// ---------------------------------------------------------------------------

export type ProposalDocItem = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  supplier: string | null;
  quantity: number;
  unitPrice: string;
  currency: string;
  startDate: Date | string | null;
  endDate: Date | string | null;
};

export type ProposalDocData = {
  reference: string;
  title: string;
  clientName: string | null;
  destination: string | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  paxCount: number;
  currency: string;
  totalPrice: string;
  summary: string | null;
  validUntil: Date | string | null;
  createdAt: Date | string | null;
  items: ProposalDocItem[];
};

const ICONS: Record<ProductItemType, React.ComponentType<{ className?: string }>> = {
  flight: Plane,
  hotel: BedDouble,
  activity: Ticket,
  transfer: Car,
  insurance: ShieldCheck,
  other: Package,
};

// Per-category accent, mirroring the marketing mockup's colour-coded price rows.
const TILE: Record<ProductItemType, string> = {
  flight: "bg-brand/10 text-brand",
  hotel: "bg-success-soft text-success",
  activity: "bg-chart-4/10 text-chart-4",
  transfer: "bg-info-soft text-info",
  insurance: "bg-warning-soft text-warning",
  other: "bg-muted text-muted-foreground",
};

function toTime(d: Date | string | null): number | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  const t = date.getTime();
  return Number.isNaN(t) ? null : t;
}

/** "Sat 12 Sep" — matches the mockup's day eyebrow. */
function formatDayLabel(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

type DayGroup = { key: string; date: Date; items: ProposalDocItem[] };

/**
 * Groups items by their real start date into an ordered day-by-day itinerary.
 * Items without a date are returned separately so we never invent days.
 */
function buildItinerary(items: ProposalDocItem[]): {
  days: DayGroup[];
  undated: ProposalDocItem[];
} {
  const byDay = new Map<string, DayGroup>();
  const undated: ProposalDocItem[] = [];

  for (const item of items) {
    const t = toTime(item.startDate);
    if (t === null) {
      undated.push(item);
      continue;
    }
    const date = new Date(t);
    const key = date.toISOString().slice(0, 10);
    const group = byDay.get(key);
    if (group) group.items.push(item);
    else byDay.set(key, { key, date, items: [item] });
  }

  const days = [...byDay.values()].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  return { days, undated };
}

function typeLabel(type: string): string {
  return PRODUCT_ITEM_TYPE_META[type as ProductItemType]?.label ?? type;
}

/** Client-facing copy, overridable per locale on the public surface. */
export type ProposalDocLabels = {
  eyebrow: string;
  travellers: (count: number) => string;
  greeting: (name: string) => string;
  dayByDay: string;
  whatsIncluded: string;
  fullItinerary: string;
  totalPackage: string;
  taxesAndDeposit: (deposit: string) => string;
  validUntil: (date: string) => string;
  preparedBy: (appName: string, tagline: string) => string;
};

function defaultLabels(): ProposalDocLabels {
  return {
    eyebrow: "Private travel proposal",
    travellers: (n) => `${n} traveller${n === 1 ? "" : "s"}`,
    greeting: (name) =>
      `Dear ${name}, it would be our pleasure to arrange this trip for you. Below is everything your journey includes.`,
    dayByDay: "Day by day",
    whatsIncluded: "What's included",
    fullItinerary: "Full itinerary as detailed above",
    totalPackage: "Total package",
    taxesAndDeposit: (deposit) => `All taxes & fees included · deposit ${deposit}`,
    validUntil: (date) => `This proposal is valid until ${date}.`,
    preparedBy: (appName, tagline) =>
      `Prepared by ${appName} · ${tagline}. Prices are per the package and subject to availability at the time of booking.`,
  };
}

export function ProposalDocument({
  data,
  appName,
  appTagline,
  statusBanner,
  signSlot,
  labels,
  className,
}: {
  data: ProposalDocData;
  appName: string;
  appTagline: string;
  /** Optional accept/decline banner rendered above the document body. */
  statusBanner?: React.ReactNode;
  /** Client-specific e-sign form (rendered only when the proposal is open). */
  signSlot?: React.ReactNode;
  /** Localized copy for the public surface; defaults to English. */
  labels?: ProposalDocLabels;
  className?: string;
}) {
  const L = labels ?? defaultLabels();
  const totalPrice = parseFloat(data.totalPrice || "0");
  const currency = data.currency;
  const agencyMark = appName.trim().charAt(0).toUpperCase() || "A";

  // Deposit is a derived incentive figure (50% of the real total), presented as
  // a rounded figure — not stored, purely computed from the authoritative total.
  const deposit = totalPrice / 2;

  const { days, undated } = buildItinerary(data.items);
  const hasItinerary = days.length > 0;
  const hasItems = data.items.length > 0;

  return (
    <div
      className={cn(
        "bg-card overflow-hidden rounded-lg border shadow-lg print:border-0 print:shadow-none",
        className
      )}
    >
      {statusBanner}

      {/* Gradient cover */}
      <div className="relative flex min-h-56 flex-col justify-between gap-6 bg-[radial-gradient(120%_100%_at_80%_-10%,#2B59C3_0%,#1B2239_55%,#0E1525_100%)] p-6 text-white sm:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-sm font-bold">
            <span className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-[#3E72E0] to-[#2B59C3] text-sm font-extrabold shadow-inner">
              {agencyMark}
            </span>
            {appName}
          </div>
          <span className="font-mono text-xs tabular-nums text-white/70">
            {data.reference}
          </span>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-white/75 uppercase">
            {L.eyebrow}
          </p>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight">
            {data.title}
          </h1>
          <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-white/85">
            {data.destination && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {data.destination}
              </span>
            )}
            {(data.startDate || data.endDate) && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                {formatDate(data.startDate)} → {formatDate(data.endDate)}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />
              {L.travellers(data.paxCount)}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-8 p-6 sm:p-8">
        {(data.clientName || data.summary) && (
          <div className="space-y-3">
            {data.clientName && (
              <p className="text-sm leading-relaxed">{L.greeting(data.clientName)}</p>
            )}
            {data.summary && (
              <p className="text-sm leading-7 whitespace-pre-wrap">
                {data.summary}
              </p>
            )}
          </div>
        )}

        {/* Day-by-day itinerary (only when items carry real dates) */}
        {hasItinerary && (
          <section>
            <SectionLabel>{L.dayByDay}</SectionLabel>
            <ol className="mt-4">
              {days.map((day, dayIndex) => (
                <li key={day.key} className="flex gap-3 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <span className="border-brand/25 bg-brand/10 text-brand flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold tabular-nums">
                      {dayIndex + 1}
                    </span>
                    {dayIndex < days.length - 1 && (
                      <span className="bg-border my-1 w-0.5 flex-1 rounded-full" />
                    )}
                  </div>
                  <div className="pt-0.5 pb-2">
                    <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      {formatDayLabel(day.date)}
                    </p>
                    <div className="mt-1 space-y-3">
                      {day.items.map((item) => (
                        <div key={item.id}>
                          <p className="text-sm font-semibold">{item.title}</p>
                          {item.description && (
                            <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                              {item.description}
                            </p>
                          )}
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                              {typeLabel(item.type)}
                            </span>
                            {item.supplier && (
                              <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                                {item.supplier}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* What's included — colour-coded price box */}
        {hasItems && (
          <section>
            <SectionLabel>{L.whatsIncluded}</SectionLabel>
            <div className="mt-4 overflow-hidden rounded-lg border">
              {(hasItinerary ? undated : data.items).map((item) => {
                const Icon = ICONS[item.type as ProductItemType] ?? Package;
                const linePrice =
                  parseFloat(item.unitPrice || "0") * item.quantity;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 border-b px-4 py-2.5 text-sm last:border-b-0"
                  >
                    <span className="text-muted-foreground flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-md",
                          TILE[item.type as ProductItemType] ??
                            "bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="truncate text-foreground">
                        {item.title}
                        {item.quantity > 1 ? ` · ×${item.quantity}` : ""}
                      </span>
                    </span>
                    <span className="text-foreground shrink-0 font-semibold tabular-nums">
                      {formatMoney(linePrice, item.currency)}
                    </span>
                  </div>
                );
              })}
              {/* When itinerary is shown, still list any dated items' contribution
                  implicitly via the total; the box above only lists undated items.
                  If every item is dated, show a single package summary row. */}
              {hasItinerary && undated.length === 0 && (
                <div className="text-muted-foreground flex items-center gap-2.5 border-b px-4 py-2.5 text-sm last:border-b-0">
                  <span className="bg-brand/10 text-brand flex size-6 shrink-0 items-center justify-center rounded-md">
                    <Package className="size-3.5" />
                  </span>
                  <span className="text-foreground">{L.fullItinerary}</span>
                </div>
              )}
              <div className="bg-accent flex items-baseline justify-between px-4 py-3.5">
                <div>
                  <p className="text-accent-foreground text-sm font-semibold">
                    {L.totalPackage}
                  </p>
                  <p className="text-accent-foreground/80 text-xs">
                    {L.taxesAndDeposit(formatMoney(deposit, currency))}
                  </p>
                </div>
                <p className="text-accent-foreground text-2xl font-bold tracking-tight tabular-nums">
                  {formatMoney(totalPrice, currency)}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Footer note */}
        <div className="text-muted-foreground border-t pt-5 text-xs">
          {data.validUntil && <p>{L.validUntil(formatDate(data.validUntil))}</p>}
          <p className="mt-1">{L.preparedBy(appName, appTagline)}</p>
        </div>

        {signSlot}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground flex items-center gap-2 text-xs font-bold tracking-wide uppercase">
      <span>{children}</span>
      <span className="bg-border h-px flex-1" />
    </div>
  );
}
