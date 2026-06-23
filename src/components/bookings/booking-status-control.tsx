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
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (value: string) => {
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
