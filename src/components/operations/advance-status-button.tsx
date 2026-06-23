"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { advanceStatus } from "@/lib/actions/bookings";
import { BOOKING_STATUS_META, type BookingStatus } from "@/lib/domain";

export function AdvanceStatusButton({
  bookingId,
  nextStatus,
}: {
  bookingId: string;
  nextStatus: BookingStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const res = await advanceStatus(bookingId);
      if (res.ok) {
        toast.success(`Moved to ${BOOKING_STATUS_META[nextStatus]?.label ?? nextStatus}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Button size="sm" variant="outline" className="w-full" onClick={onClick} disabled={pending}>
      {pending ? "…" : BOOKING_STATUS_META[nextStatus]?.label ?? nextStatus}
      <ArrowRight className="ml-1 size-3.5" />
    </Button>
  );
}
