import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export type BookingEventRow = {
  id: string;
  event: string;
  providerId: string | null;
  createdAt: Date | string;
};

// Stable event name -> human label + dot tone. Callers log these exact strings
// (see schema booking_event.event). Unknown names fall back to the raw value.
const EVENT_META: Record<string, { label: string; tone: string }> = {
  search_initiated: { label: "Search initiated", tone: "bg-muted-foreground/40" },
  offer_selected: { label: "Offer selected", tone: "bg-blue-500" },
  price_validated: { label: "Price validated", tone: "bg-blue-500" },
  price_changed: { label: "Price changed", tone: "bg-amber-500" },
  booking_submitted: { label: "Booking submitted", tone: "bg-blue-500" },
  booking_confirmed: { label: "Booking confirmed", tone: "bg-green-500" },
  booking_failed: { label: "Booking failed", tone: "bg-red-500" },
  booking_cancelled: { label: "Booking cancelled", tone: "bg-red-500" },
  payment_started: { label: "Payment started", tone: "bg-amber-500" },
  payment_completed: { label: "Payment completed", tone: "bg-green-500" },
};

function labelFor(event: string): string {
  return (
    EVENT_META[event]?.label ??
    event.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

/**
 * Activity timeline (deck: Activity panel).
 *
 * Backed by booking_event real rows (event name + providerId + createdAt).
 * Omitted when there are no events. No fabricated actor names or free-text
 * descriptions — only the logged event, its provider, and its timestamp.
 */
export function BookingActivity({ events }: { events: BookingEventRow[] }) {
  if (events.length === 0) return null;

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-4" /> Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-5 pl-5">
          <span className="bg-border absolute top-1 bottom-1 left-[3px] w-px" aria-hidden />
          {events.map((e) => {
            const tone = EVENT_META[e.event]?.tone ?? "bg-muted-foreground/40";
            return (
              <li key={e.id} className="relative">
                <span
                  className={cn(
                    "ring-background absolute top-1 -left-5 size-[7px] rounded-full ring-2",
                    tone
                  )}
                  aria-hidden
                />
                <p className="text-sm font-medium">{labelFor(e.event)}</p>
                <p className="text-muted-foreground text-xs">
                  {e.providerId && (
                    <span className="capitalize">{e.providerId} · </span>
                  )}
                  {formatRelative(e.createdAt)}
                </p>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
