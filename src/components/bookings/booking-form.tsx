"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createBooking, updateBooking, type BookingInput } from "@/lib/actions/bookings";
import {
  SUPPORTED_CURRENCIES,
  TRAVEL_PURPOSES,
  TRAVEL_PURPOSE_LABEL,
  TRIP_TYPES,
  TRIP_TYPE_LABEL,
} from "@/lib/domain";
import type { ClientOption } from "@/lib/queries";

type FormState = {
  clientId: string;
  destination: string;
  departDate: string;
  returnDate: string;
  travelPurpose: string;
  tripType: string;
  currency: string;
  leadTravellerName: string;
  notes: string;
};

export function BookingForm({
  mode,
  bookingId,
  clients,
  initial,
}: {
  mode: "create" | "edit";
  bookingId?: string;
  clients: ClientOption[];
  initial?: Partial<FormState>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>({
    clientId: initial?.clientId ?? "",
    destination: initial?.destination ?? "",
    departDate: initial?.departDate ?? "",
    returnDate: initial?.returnDate ?? "",
    travelPurpose: initial?.travelPurpose ?? "",
    tripType: initial?.tripType ?? "",
    currency: initial?.currency ?? "DZD",
    leadTravellerName: initial?.leadTravellerName ?? "",
    notes: initial?.notes ?? "",
  });

  const set = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: BookingInput = {
      clientId: form.clientId || undefined,
      destination: form.destination,
      departDate: form.departDate,
      returnDate: form.returnDate,
      travelPurpose: form.travelPurpose as BookingInput["travelPurpose"],
      tripType: form.tripType as BookingInput["tripType"],
      currency: form.currency,
      notes: form.notes,
      ...(mode === "create" ? { leadTravellerName: form.leadTravellerName } : {}),
    };
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createBooking(payload)
          : await updateBooking(bookingId!, payload);
      if (res.ok) {
        toast.success(mode === "create" ? "Booking created" : "Saved");
        const id = mode === "create" && "data" in res ? res.data?.id : bookingId;
        router.push(id ? `/bookings/${id}` : "/bookings");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="clientId">Client</Label>
            {clients.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No clients yet.{" "}
                <a href="/clients/new" className="text-primary underline underline-offset-2">
                  Add a client first
                </a>{" "}
                before creating a booking.
              </p>
            ) : (
              <Select
                id="clientId"
                value={form.clientId}
                onChange={(e) => set("clientId", e.target.value)}
              >
                <option value="">No client linked</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="destination">Destination</Label>
            <Input
              id="destination"
              value={form.destination}
              onChange={(e) => set("destination", e.target.value)}
              placeholder="e.g. Marrakech, Morocco"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="departDate">Depart date</Label>
            <Input
              id="departDate"
              type="date"
              value={form.departDate}
              onChange={(e) => set("departDate", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="returnDate">Return date</Label>
            <Input
              id="returnDate"
              type="date"
              value={form.returnDate}
              onChange={(e) => set("returnDate", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="travelPurpose">Travel purpose</Label>
            <Select
              id="travelPurpose"
              value={form.travelPurpose}
              onChange={(e) => set("travelPurpose", e.target.value)}
            >
              <option value="">Not set</option>
              {TRAVEL_PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {TRAVEL_PURPOSE_LABEL[p]}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tripType">Trip type</Label>
            <Select
              id="tripType"
              value={form.tripType}
              onChange={(e) => set("tripType", e.target.value)}
            >
              <option value="">Not set</option>
              {TRIP_TYPES.map((tt) => (
                <option key={tt} value={tt}>
                  {TRIP_TYPE_LABEL[tt]}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select
              id="currency"
              value={form.currency}
              onChange={(e) => set("currency", e.target.value)}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>

          {mode === "create" && (
            <div className="space-y-2">
              <Label htmlFor="lead">Lead traveller</Label>
              <Input
                id="lead"
                value={form.leadTravellerName}
                onChange={(e) => set("leadTravellerName", e.target.value)}
                placeholder="Optional — add passport details next"
              />
            </div>
          )}

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create booking" : "Save changes"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
