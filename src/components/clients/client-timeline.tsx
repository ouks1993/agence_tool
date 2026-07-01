import Link from "next/link";
import {
  Activity,
  Banknote,
  Bell,
  Clock,
  Plus,
  TicketCheck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatRelative, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TimelineEvent = {
  id: string;
  date: Date;
  label: string;
  kind: "activity" | "notification" | "booking_status" | "payment";
  entityHref?: string | undefined;
};

/**
 * Per-kind presentation: a soft icon chip + a short channel label, mapped from
 * the existing event kinds. The TimelineEvent shape is unchanged.
 */
const KIND_META: Record<
  TimelineEvent["kind"],
  { label: string; icon: LucideIcon; chip: string; dot: string }
> = {
  activity: {
    label: "Activity",
    icon: Activity,
    chip: "bg-primary/10 text-primary",
    dot: "bg-primary",
  },
  notification: {
    label: "Notification",
    icon: Bell,
    chip: "bg-info-soft text-info",
    dot: "bg-info",
  },
  booking_status: {
    label: "Booking",
    icon: TicketCheck,
    chip: "bg-warning-soft text-warning",
    dot: "bg-warning",
  },
  payment: {
    label: "Payment",
    icon: Banknote,
    chip: "bg-success-soft text-success",
    dot: "bg-success",
  },
};

export function ClientTimeline({
  events,
  logHref,
}: {
  events: TimelineEvent[];
  /** When provided, renders a "Log activity" action in the header. */
  logHref?: string;
}) {
  return (
    <Card className="card-elevated">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="text-muted-foreground size-4" />
            Communication timeline
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Activities, notifications &amp; payments
          </p>
        </div>
        {logHref && (
          <Button asChild variant="outline" size="sm">
            <Link href={logHref}>
              <Plus className="mr-1.5 size-4" />
              Log activity
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No activity recorded yet.
          </p>
        ) : (
          <ol className="relative space-y-5">
            {/* Vertical line connecting the chips. */}
            <span
              aria-hidden
              className="bg-border absolute top-3 bottom-3 left-[15px] w-px"
            />
            {events.map((event) => {
              const meta = KIND_META[event.kind];
              const Icon = meta.icon;
              return (
                <li key={event.id} className="relative flex gap-3.5">
                  <span
                    aria-hidden
                    className={cn(
                      "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full",
                      meta.chip
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                            meta.chip
                          )}
                        >
                          {meta.label}
                        </span>
                        {event.entityHref ? (
                          <Link
                            href={event.entityHref}
                            className="min-w-0 truncate text-sm font-medium hover:underline"
                          >
                            {event.label}
                          </Link>
                        ) : (
                          <span className="min-w-0 truncate text-sm font-medium">
                            {event.label}
                          </span>
                        )}
                      </div>
                      <time
                        className="text-muted-foreground shrink-0 text-xs tabular-nums"
                        dateTime={event.date.toISOString()}
                        title={`${formatDate(event.date)} · ${formatTime(
                          event.date.toISOString()
                        )}`}
                      >
                        {formatRelative(event.date)}
                      </time>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
