"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { addItemToBooking, type BookingItemInput } from "@/lib/actions/bookings";

export type BookingOption = { id: string; label: string };
export type ClientOption = { id: string; name: string };

export function AddToBookingDialog({
  item,
  itemSummary,
  bookings,
  clients,
  defaultDestination,
}: {
  item: BookingItemInput;
  itemSummary: string;
  bookings: BookingOption[];
  clients: ClientOption[];
  defaultDestination?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"existing" | "new">(
    bookings.length ? "existing" : "new"
  );
  const [bookingId, setBookingId] = useState(bookings[0]?.id ?? "");
  const [clientId, setClientId] = useState("");
  const [destination, setDestination] = useState(defaultDestination ?? "");

  const submit = () => {
    startTransition(async () => {
      const res = await addItemToBooking(
        mode === "existing"
          ? { bookingId, item }
          : { clientId: clientId || undefined, destination: destination || undefined, item }
      );
      if (res.ok && res.data) {
        toast.success("Added to booking", {
          action: {
            label: "Open",
            onClick: () => router.push(`/bookings/${res.data!.bookingId}`),
          },
        });
        setOpen(false);
        router.refresh();
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Plus className="mr-1 size-4" />
          Add to booking
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to booking</DialogTitle>
          <DialogDescription>{itemSummary}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "existing" ? "default" : "outline"}
              onClick={() => setMode("existing")}
              disabled={bookings.length === 0}
            >
              Existing booking
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "new" ? "default" : "outline"}
              onClick={() => setMode("new")}
            >
              New booking
            </Button>
          </div>

          {mode === "existing" ? (
            <div className="space-y-2">
              <Label htmlFor="bk">Booking</Label>
              <Select id="bk" value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="bk-client">Client (optional)</Label>
                <Select
                  id="bk-client"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">No client yet</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bk-dest">Destination</Label>
                <Input
                  id="bk-dest"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || (mode === "existing" && !bookingId)}>
            {pending ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
