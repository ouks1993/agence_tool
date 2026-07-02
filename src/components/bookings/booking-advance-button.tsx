"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { advanceStatus } from "@/lib/actions/bookings";
import {
  BOOKING_LIFECYCLE,
  BOOKING_STATUS_META,
  nextBookingStatus,
} from "@/lib/domain";

/**
 * Primary hero CTA that advances the booking to the next lifecycle stage
 * (deck: the emphasised "Issue tickets" primary action). Mirrors the soft
 * warnings the stepper used to enforce, and reuses the real `advanceStatus`
 * server action so status transitions stay in one place. Renders nothing at the
 * end of the lifecycle (or when cancelled), where there is no forward path.
 */
export function BookingAdvanceButton({
  bookingId,
  status,
  hasItems,
  hasBalance,
  belowDeposit,
}: {
  bookingId: string;
  status: string;
  hasItems: boolean;
  hasBalance: boolean;
  /** True when the agency's deposit threshold isn't yet met (blocks `confirmed`). */
  belowDeposit?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const next = nextBookingStatus(status);
  if (!next || next === "cancelled") return null;

  const onAdvance = () => {
    if (next === "confirmed" && !hasItems) {
      if (!window.confirm("This booking has no trip services yet. Confirm anyway?"))
        return;
    }
    // Confirming unlocks at the agency deposit threshold; ticketing/completion
    // still require the full balance to be settled.
    if (next === "confirmed" && belowDeposit) {
      if (!window.confirm("The required deposit hasn't been received yet. Advance anyway?"))
        return;
    }
    const nextIndex = BOOKING_LIFECYCLE.indexOf(next);
    const confirmedIndex = BOOKING_LIFECYCLE.indexOf("confirmed");
    if (hasBalance && confirmedIndex !== -1 && nextIndex > confirmedIndex) {
      if (!window.confirm("There is still a balance due. Advance anyway?")) return;
    }

    startTransition(async () => {
      const res = await advanceStatus(bookingId);
      if (res.ok) {
        toast.success(`Moved to ${BOOKING_STATUS_META[next]?.label ?? next}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Button size="sm" onClick={onAdvance} disabled={pending}>
      <Check className="mr-2 size-4" />
      {`Advance to ${BOOKING_STATUS_META[next]?.label ?? next}`}
      <ArrowRight className="ml-1.5 size-4" />
    </Button>
  );
}
