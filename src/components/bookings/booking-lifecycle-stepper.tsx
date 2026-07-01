import { Check, Circle, Plane, Send, Wallet, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  BOOKING_LIFECYCLE,
  BOOKING_STATUS_META,
  type BookingStatus,
} from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Horizontal stepper visualising a booking's progression through the operational
 * lifecycle (deck: status stepper). Presentation-only — the advance action lives
 * in the hero (BookingStatusControl), matching the deck which keeps the stepper
 * free of controls.
 *
 * Per-stage icons follow the deck (draft/awaiting/confirmed/ticketed/completed);
 * completed connectors are success-green; the current stage shows a "now"
 * sublabel with the booking's last-updated date. We never invent per-stage
 * timestamps that aren't stored — only the current stage carries `updatedAt`.
 */

const STAGE_ICON: Record<BookingStatus, React.ComponentType<{ className?: string }>> = {
  draft: Circle,
  awaiting_payment: Wallet,
  confirmed: Check,
  ticketed: Send,
  completed: Plane,
  cancelled: XCircle,
};

export function BookingLifecycleStepper({
  status,
  updatedAt,
}: {
  status: string;
  /** Booking last-updated timestamp — dates the current stage only. */
  updatedAt?: Date | string | null;
}) {
  // Cancelled is an exit state: no stepper, just a muted pill.
  if (status === "cancelled") {
    return (
      <Card className="card-elevated">
        <CardContent className="p-4">
          <StatusBadge
            variant="danger"
            label={BOOKING_STATUS_META.cancelled.label}
            dot
          />
        </CardContent>
      </Card>
    );
  }

  const currentIndex = BOOKING_LIFECYCLE.indexOf(status as BookingStatus);

  return (
    <Card className="card-elevated">
      <CardContent className="p-5">
        <ol className="flex items-start">
          {BOOKING_LIFECYCLE.map((stage, index) => {
            const isPast = currentIndex > -1 && index < currentIndex;
            const isCurrent = index === currentIndex;
            const isDone = isPast;
            const meta = BOOKING_STATUS_META[stage];
            const Icon = isPast ? Check : STAGE_ICON[stage];

            return (
              <li
                key={stage}
                className="flex flex-1 flex-col items-center last:flex-none"
              >
                <div className="flex w-full items-center">
                  {/* Leading connector (green once passed). */}
                  {index > 0 && (
                    <span
                      className={cn(
                        "h-0.5 flex-1 rounded-full",
                        index <= currentIndex ? "bg-success" : "bg-border-strong"
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      isDone && "bg-success border-success text-white",
                      isCurrent &&
                        "bg-primary border-primary text-primary-foreground ring-primary/25 ring-4",
                      !isDone &&
                        !isCurrent &&
                        "bg-card border-border-strong text-muted-foreground/50"
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  {/* Trailing connector (green once passed). */}
                  {index < BOOKING_LIFECYCLE.length - 1 && (
                    <span
                      className={cn(
                        "h-0.5 flex-1 rounded-full",
                        index < currentIndex ? "bg-success" : "bg-border-strong"
                      )}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "mt-2 text-center text-[11.5px] leading-tight whitespace-nowrap",
                    isCurrent
                      ? "text-primary font-semibold"
                      : isDone
                        ? "text-foreground font-medium"
                        : "text-muted-foreground/70"
                  )}
                >
                  {meta.label}
                  {isCurrent && (
                    <span className="text-muted-foreground mt-0.5 block text-[10px] font-normal tabular-nums">
                      {updatedAt ? `${formatDate(updatedAt)} · now` : "now"}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
