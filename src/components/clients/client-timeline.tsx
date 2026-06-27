import Link from "next/link";
import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TimelineEvent = {
  id: string;
  date: Date;
  label: string;
  kind: "activity" | "notification" | "booking_status" | "payment";
  entityHref?: string | undefined;
};

const DOT_CLASS: Record<TimelineEvent["kind"], string> = {
  activity: "bg-primary",
  notification: "bg-blue-500",
  booking_status: "bg-amber-500",
  payment: "bg-green-500",
};

export function ClientTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="size-4" /> Activity timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No activity recorded yet.
          </p>
        ) : (
          <ol className="relative space-y-6">
            {/* Vertical line connecting the dots. */}
            <span
              aria-hidden
              className="bg-border absolute top-1 bottom-1 left-[5px] w-px"
            />
            {events.map((event) => (
              <li key={event.id} className="relative flex gap-4 pl-1">
                <span
                  aria-hidden
                  className={cn(
                    "relative z-10 mt-1 size-2.5 shrink-0 rounded-full",
                    DOT_CLASS[event.kind]
                  )}
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  {event.entityHref ? (
                    <Link
                      href={event.entityHref}
                      className="text-sm font-medium hover:underline"
                    >
                      {event.label}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium">{event.label}</p>
                  )}
                  <p className="text-muted-foreground text-xs">
                    {formatRelative(event.date)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
