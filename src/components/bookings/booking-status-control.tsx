"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select } from "@/components/ui/select";
import { setBookingStatus } from "@/lib/actions/bookings";
import {
  BOOKING_LIFECYCLE,
  BOOKING_STATUS_META,
  type BookingStatus,
} from "@/lib/domain";

/**
 * Legal transitions offered from `current`. Server-side (`setBookingStatus`)
 * remains the source of truth — this only narrows the dropdown to sensible
 * choices so agents aren't offered illegal jumps:
 *  - keep the current status,
 *  - step forward exactly one lifecycle stage (each forward step is gated
 *    server-side: items required, deposit threshold for `confirmed`, zero
 *    balance for ticketing/completion, ticketing supplier flow),
 *  - move backward to any earlier lifecycle stage (reversible),
 *  - cancel from any state.
 * A cancelled booking can only be re-opened back to the start of the lifecycle.
 */
function allowedTransitions(current: string): BookingStatus[] {
  const forward = new Set<BookingStatus>();
  const i = BOOKING_LIFECYCLE.indexOf(current as BookingStatus);

  if (i === -1) {
    // Off-lifecycle (e.g. cancelled): allow reopening to the first stage only.
    forward.add(BOOKING_LIFECYCLE[0]!);
  } else {
    for (let b = 0; b <= i; b++) forward.add(BOOKING_LIFECYCLE[b]!); // current + backward
    const next = BOOKING_LIFECYCLE[i + 1];
    if (next) forward.add(next); // one step forward
  }

  // Keep lifecycle order for the listed stages, then always offer cancel.
  return [...BOOKING_LIFECYCLE.filter((s) => forward.has(s)), "cancelled"];
}

export function BookingStatusControl({
  id,
  status,
  hasItems,
  hasBalance,
  belowDeposit,
}: {
  id: string;
  status: string;
  hasItems?: boolean;
  hasBalance?: boolean;
  /** True when the agency's deposit threshold isn't yet met (blocks `confirmed`). */
  belowDeposit?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const options = allowedTransitions(status);

  const change = (value: string) => {
    if (value === status) return;
    const target = value as BookingStatus;

    // Soft warnings — ask before applying potentially premature transitions.
    // (The server enforces these hard; the prompts just avoid a surprise error.)
    if ((target === "confirmed" || target === "ticketed") && !hasItems) {
      if (!window.confirm("This booking has no trip services yet. Continue anyway?")) return;
    }
    // Confirming now unlocks at the agency deposit threshold, not zero balance.
    if (target === "confirmed" && belowDeposit) {
      if (!window.confirm("The required deposit hasn't been received yet — this will be rejected until it is. Continue?")) return;
    }
    // Ticketing / completion still require the full balance to be settled.
    if ((target === "ticketed" || target === "completed") && hasBalance) {
      if (!window.confirm("There is still a balance due — this will be rejected until it is settled. Continue?")) return;
    }
    if (target === "cancelled") {
      if (!window.confirm("Cancel this booking? This cannot be undone easily.")) return;
    }

    startTransition(async () => {
      const res = await setBookingStatus(id, target);
      if (res.ok) {
        toast.success(`Marked as ${BOOKING_STATUS_META[target]?.label ?? target}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Select
      value={status}
      onChange={(e) => change(e.target.value)}
      disabled={pending}
      className="h-8 w-36"
      aria-label="Booking status"
    >
      {/* When the current status is off-lifecycle (cancelled) it won't appear in
          the option set, so render it explicitly so the Select stays controlled. */}
      {!options.includes(status as BookingStatus) && (
        <option value={status}>
          {BOOKING_STATUS_META[status as BookingStatus]?.label ?? status}
        </option>
      )}
      {options.map((s) => (
        <option key={s} value={s}>
          {BOOKING_STATUS_META[s].label}
        </option>
      ))}
    </Select>
  );
}
