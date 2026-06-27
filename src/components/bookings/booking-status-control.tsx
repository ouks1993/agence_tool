"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select } from "@/components/ui/select";
import { setBookingStatus } from "@/lib/actions/bookings";
import { BOOKING_STATUSES, BOOKING_STATUS_META } from "@/lib/domain";

export function BookingStatusControl({
  id,
  status,
  hasItems,
  hasBalance,
}: {
  id: string;
  status: string;
  hasItems?: boolean;
  hasBalance?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (value: string) => {
    // Soft warnings — ask before applying potentially premature transitions.
    if (value === "confirmed" && !hasItems) {
      if (!window.confirm("This booking has no trip services yet. Confirm anyway?")) return;
    }
    if (value === "paid" && hasBalance) {
      if (!window.confirm("There is still a balance due. Mark as paid anyway?")) return;
    }
    if (value === "cancelled") {
      if (!window.confirm("Cancel this booking? This cannot be undone easily.")) return;
    }

    startTransition(async () => {
      const res = await setBookingStatus(
        id,
        value as "draft" | "confirmed" | "paid" | "cancelled"
      );
      if (res.ok) {
        toast.success(
          `Marked as ${BOOKING_STATUS_META[value as keyof typeof BOOKING_STATUS_META]?.label ?? value}`
        );
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
      {BOOKING_STATUSES.map((s) => (
        <option key={s} value={s}>
          {BOOKING_STATUS_META[s].label}
        </option>
      ))}
    </Select>
  );
}
