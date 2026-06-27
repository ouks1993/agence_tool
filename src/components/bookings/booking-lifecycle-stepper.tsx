"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { advanceStatus } from "@/lib/actions/bookings";
import {
  BOOKING_LIFECYCLE,
  BOOKING_STATUS_META,
  nextBookingStatus,
  type BookingStatus,
} from "@/lib/domain";
import { cn } from "@/lib/utils";

/**
 * Horizontal stepper visualising a booking's progression through the
 * operational lifecycle, with a primary "advance" action below it.
 *
 * The stepper renders the ordered `BOOKING_LIFECYCLE` stages (which exclude the
 * "cancelled" exit state). When a booking is cancelled there is no forward path,
 * so we show a muted pill instead of the steps.
 */
export function BookingLifecycleStepper({
  bookingId,
  status,
  hasItems,
  hasBalance,
}: {
  bookingId: string;
  status: string;
  hasItems: boolean;
  hasBalance: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Cancelled is an exit state: no stepper, just a muted pill.
  if (status === "cancelled") {
    return (
      <Card>
        <CardContent className="p-4">
          <span className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium">
            <XCircle className="size-4" />
            {BOOKING_STATUS_META.cancelled.label}
          </span>
        </CardContent>
      </Card>
    );
  }

  // Where the booking currently sits in the lifecycle. -1 means an unknown /
  // off-lifecycle status, in which case nothing is treated as "past".
  const currentIndex = BOOKING_LIFECYCLE.indexOf(status as BookingStatus);
  const next = nextBookingStatus(status);
  const canAdvance = next !== null && next !== "cancelled";

  const onAdvance = () => {
    if (!next) return;

    // Soft warnings mirror BookingStatusControl so the two paths behave the same.
    if (next === "confirmed" && !hasItems) {
      if (!window.confirm("This booking has no trip services yet. Confirm anyway?")) return;
    }
    // Advancing past the payment stage while money is still owed.
    const nextIndex = BOOKING_LIFECYCLE.indexOf(next);
    const paymentIndex = BOOKING_LIFECYCLE.indexOf("awaiting_payment");
    if (hasBalance && paymentIndex !== -1 && nextIndex > paymentIndex) {
      if (!window.confirm("There is still a balance due. Advance anyway?")) return;
    }

    startTransition(async () => {
      const res = await advanceStatus(bookingId);
      if (res.ok) {
        toast.success(
          `Moved to ${BOOKING_STATUS_META[next]?.label ?? next}`
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <ol className="flex items-start">
          {BOOKING_LIFECYCLE.map((stage, index) => {
            const isPast = currentIndex > -1 && index < currentIndex;
            const isCurrent = index === currentIndex;
            const meta = BOOKING_STATUS_META[stage];

            return (
              <li
                key={stage}
                className="flex flex-1 flex-col items-center last:flex-none"
              >
                <div className="flex w-full items-center">
                  {/* Leading connector (filled if we've passed this stage). */}
                  {index > 0 && (
                    <span
                      className={cn(
                        "h-px flex-1",
                        index <= currentIndex ? "bg-primary" : "bg-border"
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      isPast && "bg-primary text-primary-foreground",
                      isCurrent && "ring-primary bg-primary/10 text-primary ring-2",
                      !isPast && !isCurrent && "bg-muted text-muted-foreground"
                    )}
                  >
                    {isPast ? <Check className="size-4" /> : index + 1}
                  </span>
                  {/* Trailing connector (filled if the next stage is reached). */}
                  {index < BOOKING_LIFECYCLE.length - 1 && (
                    <span
                      className={cn(
                        "h-px flex-1",
                        index < currentIndex ? "bg-primary" : "bg-border"
                      )}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "mt-1.5 text-center text-xs",
                    isCurrent
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {meta.label}
                </span>
              </li>
            );
          })}
        </ol>

        {canAdvance && next && (
          <Button
            variant="default"
            size="sm"
            onClick={onAdvance}
            disabled={pending}
          >
            Advance to {BOOKING_STATUS_META[next]?.label ?? next}
            <ArrowRight className="ml-1 size-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
