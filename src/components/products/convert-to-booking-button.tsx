"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Briefcase } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { convertProposalToBooking } from "@/lib/actions/bookings";

/**
 * Converts an accepted proposal into a booking. Confirms first, then redirects
 * to the freshly created booking on success.
 */
export function ConvertToBookingButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const convert = () =>
    startTransition(async () => {
      const res = await convertProposalToBooking(productId);
      if (res.ok && res.data) {
        setOpen(false);
        router.push(`/bookings/${res.data.id}`);
      } else {
        toast.error((!res.ok && res.error) || "Could not convert the proposal.");
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          <Briefcase className="mr-2 size-4" />
          Convert to booking
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert to booking</DialogTitle>
          <DialogDescription>
            Convert this accepted proposal into a booking? This will create a
            new booking pre-filled with the proposal&apos;s items.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={convert} disabled={pending}>
            <Briefcase className="mr-2 size-4" />
            Convert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
