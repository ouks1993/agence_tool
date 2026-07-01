"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  FileText,
  MapPin,
  MessageSquare,
  Plane,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Right-hand context rail for the AI assistant.
 *
 * "Current client" / "Active booking" populate LIVE from the assistant's tool
 * results: whenever a getClientDetails/findClients or getBookingDetails/
 * createBooking tool resolves, the page derives the latest client/booking and
 * passes it here (never fabricated — only real tool output). Until then each
 * shows a tasteful empty state. "Suggested actions" seed the composer.
 */

/** A client surfaced by the assistant's client tools. */
export type RailClient = {
  id: string;
  name: string;
  type?: string | null;
  status?: string | null;
  email?: string | null;
  city?: string | null;
  country?: string | null;
  lifetimeValue?: { value: number; currency: string } | null;
  openBalance?: { value: number; currency: string } | null;
  bookingsCount?: number | null;
};

/** A booking surfaced by the assistant's booking tools. */
export type RailBooking = {
  id?: string | null;
  reference?: string | null;
  status?: string | null;
  statusLabel?: string | null;
  clientName?: string | null;
  destination?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  balance?: { value: number; currency: string } | null;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export type SuggestedAction = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  tone: "brand" | "green" | "amber" | "violet";
  icon: "quote" | "email" | "visa" | "flight";
};

const ICONS = {
  quote: FileText,
  email: MessageSquare,
  visa: ShieldCheck,
  flight: Plane,
} as const;

// Aligned to the deck's soft-tint token family (matches marketing/mockups
// suggested-action icon chips i1–i4): brand · success · amber(warning) · violet.
const TONE_CLASSES: Record<SuggestedAction["tone"], string> = {
  brand: "bg-brand/10 text-brand",
  green: "bg-success-soft text-success",
  amber: "bg-warning-soft text-warning",
  violet: "bg-chart-4/10 text-chart-4",
};

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground mb-3 text-[11px] font-semibold uppercase tracking-[0.06em]">
      {children}
    </p>
  );
}

export function ContextRail({
  agentName,
  actions,
  onAction,
  client,
  booking,
}: {
  agentName?: string | null;
  actions: SuggestedAction[];
  onAction: (prompt: string) => void;
  /** Latest client surfaced by the assistant's tools (null → empty state). */
  client?: RailClient | null;
  /** Latest booking surfaced by the assistant's tools (null → empty state). */
  booking?: RailBooking | null;
}) {
  return (
    <aside className="bg-card border-border hidden w-[332px] shrink-0 flex-col overflow-y-auto border-l min-[1100px]:flex">
      {/* Current client — fills live from the assistant's client tools */}
      <div className="border-border border-b p-5">
        <RailLabel>Current client</RailLabel>
        {client ? (
          <div className="border-border bg-card rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <div className="bg-brand/10 text-brand flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                {initials(client.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-semibold">
                  {client.name}
                </p>
                <p className="text-muted-foreground mt-0.5 truncate text-xs capitalize">
                  {[client.type, client.status].filter(Boolean).join(" · ")}
                  {client.city ? ` · ${client.city}` : ""}
                </p>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {client.lifetimeValue && (
                <div>
                  <dt className="text-muted-foreground">Lifetime value</dt>
                  <dd className="text-foreground font-semibold tabular-nums">
                    {formatMoney(
                      client.lifetimeValue.value,
                      client.lifetimeValue.currency
                    )}
                  </dd>
                </div>
              )}
              {client.openBalance && (
                <div>
                  <dt className="text-muted-foreground">Open balance</dt>
                  <dd
                    className={cn(
                      "font-semibold tabular-nums",
                      client.openBalance.value > 0
                        ? "text-warning"
                        : "text-success"
                    )}
                  >
                    {formatMoney(
                      client.openBalance.value,
                      client.openBalance.currency
                    )}
                  </dd>
                </div>
              )}
              {typeof client.bookingsCount === "number" && (
                <div>
                  <dt className="text-muted-foreground">Trips</dt>
                  <dd className="text-foreground font-semibold tabular-nums">
                    {client.bookingsCount}
                  </dd>
                </div>
              )}
            </dl>
            <Link
              href={`/clients/${client.id}`}
              className="text-primary hover:text-primary/80 mt-3 inline-flex items-center gap-1 text-xs font-medium"
            >
              View profile <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ) : (
          <div className="border-border bg-muted/40 flex items-start gap-3 rounded-lg border border-dashed p-4">
            <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
              <UserRound className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-foreground text-sm font-medium">
                No client in context
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-5">
                Ask Atlas to look up a client and their preferences will appear
                here.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Active booking — fills live from the assistant's booking tools */}
      <div className="border-border border-b p-5">
        <RailLabel>Active booking</RailLabel>
        {booking ? (
          <div className="border-border bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <span className="bg-brand/10 text-brand flex size-8 shrink-0 items-center justify-center rounded-md">
                <BriefcaseBusiness className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate font-mono text-sm font-semibold">
                  {booking.reference ?? "Booking"}
                </p>
                {booking.statusLabel && (
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {booking.statusLabel}
                    {booking.clientName ? ` · ${booking.clientName}` : ""}
                  </p>
                )}
              </div>
            </div>
            {(booking.destination || booking.startDate) && (
              <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">
                  {booking.destination}
                  {booking.startDate
                    ? ` · ${formatDate(booking.startDate)}${
                        booking.endDate ? ` → ${formatDate(booking.endDate)}` : ""
                      }`
                    : ""}
                </span>
              </p>
            )}
            {booking.balance && (
              <p className="mt-2 text-xs">
                <span className="text-muted-foreground">Balance: </span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    booking.balance.value > 0 ? "text-warning" : "text-success"
                  )}
                >
                  {formatMoney(booking.balance.value, booking.balance.currency)}
                </span>
              </p>
            )}
            {booking.id && (
              <Link
                href={`/bookings/${booking.id}`}
                className="text-primary hover:text-primary/80 mt-3 inline-flex items-center gap-1 text-xs font-medium"
              >
                Open booking <ArrowRight className="size-3.5" />
              </Link>
            )}
          </div>
        ) : (
          <div className="border-border bg-muted/40 rounded-lg border border-dashed p-4">
            <p className="text-foreground text-sm font-medium">
              No booking attached
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs leading-5">
              Assemble a booking file from a chat and Atlas will surface its
              progress here.
            </p>
          </div>
        )}
      </div>

      {/* Suggested actions — real: seed the composer */}
      <div className="border-border flex-1 border-b p-5">
        <RailLabel>Suggested actions</RailLabel>
        <div className="space-y-2">
          {actions.map((action) => {
            const Icon = ICONS[action.icon];
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => onAction(action.prompt)}
                className="border-border bg-card hover:border-primary hover:bg-accent focus-visible:ring-ring/50 group flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md",
                    TONE_CLASSES[action.tone]
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block text-sm font-medium">
                    {action.title}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                    {action.description}
                  </span>
                </span>
                <ArrowRight className="text-muted-foreground size-4 shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer usage note */}
      <div className="p-5">
        <div className="text-muted-foreground flex items-start gap-2 text-xs leading-5">
          <Bot className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {agentName ? `Signed in as ${agentName}. ` : ""}Grounded on your live
            CRM &amp; supplier data — always review before sending.
          </span>
        </div>
      </div>
    </aside>
  );
}
