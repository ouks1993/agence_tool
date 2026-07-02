"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createBooking, updateBooking, type BookingInput } from "@/lib/actions/bookings";
import {
  DEFAULT_CURRENCY,
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
  depositPercent: string;
  notes: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

/** Client-side mirror of the server rules — keeps errors inline before a round-trip. */
function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.clientId) errors.clientId = "Select the client this booking is for.";
  if (!form.destination.trim()) errors.destination = "Enter a destination.";
  if (!form.departDate) errors.departDate = "Set the departure date.";
  if (!form.returnDate) errors.returnDate = "Set the return date.";
  if (
    form.departDate &&
    form.returnDate &&
    form.returnDate < form.departDate
  ) {
    errors.returnDate = "Return date can't be before departure.";
  }
  return errors;
}

/** Small required-field marker for labels. */
function RequiredMark() {
  return (
    <span className="text-destructive ml-0.5" aria-hidden>
      *
    </span>
  );
}

function FieldError({ id, message }: { id: string; message?: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="text-destructive text-sm" role="alert">
      {message}
    </p>
  );
}

export function BookingForm({
  mode,
  bookingId,
  clients,
  agencyDepositPercent,
  initial,
}: {
  mode: "create" | "edit";
  bookingId?: string;
  clients: ClientOption[];
  // The effective deposit % this booking would inherit (its snapshotted override
  // resolved against the agency default) — shown as the placeholder/hint when
  // the edit field is left empty. Only supplied in edit mode.
  agencyDepositPercent?: number;
  initial?: Partial<FormState>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormState>({
    clientId: initial?.clientId ?? "",
    destination: initial?.destination ?? "",
    departDate: initial?.departDate ?? "",
    returnDate: initial?.returnDate ?? "",
    travelPurpose: initial?.travelPurpose ?? "",
    tripType: initial?.tripType ?? "",
    currency: initial?.currency ?? DEFAULT_CURRENCY,
    leadTravellerName: initial?.leadTravellerName ?? "",
    depositPercent: initial?.depositPercent ?? "",
    notes: initial?.notes ?? "",
  });

  const set = (key: keyof FormState, value: string) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Re-validate live once the user has attempted a submit.
      if (submitted) setErrors(validate(next));
      return next;
    });
  };

  const noClients = clients.length === 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const payload: BookingInput = {
      clientId: form.clientId || undefined,
      destination: form.destination,
      departDate: form.departDate,
      returnDate: form.returnDate,
      travelPurpose: form.travelPurpose as BookingInput["travelPurpose"],
      tripType: form.tripType as BookingInput["tripType"],
      currency: form.currency,
      notes: form.notes,
      ...(mode === "create"
        ? { leadTravellerName: form.leadTravellerName }
        : {
            // Empty = inherit → null (not 0, which would mean "no deposit").
            depositPercent:
              form.depositPercent.trim() === ""
                ? null
                : Number(form.depositPercent),
          }),
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

  const invalid = (key: keyof FormState) => (errors[key] ? true : undefined);
  const describedBy = (key: keyof FormState, help?: string) =>
    [errors[key] ? `${key}-error` : null, help ? `${key}-help` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {/* --- Trip -------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trip</CardTitle>
          <CardDescription>Who is travelling and where.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="clientId">
              Client
              <RequiredMark />
            </Label>
            {noClients ? (
              <p className="text-muted-foreground text-sm">
                No clients yet.{" "}
                <Link href="/clients/new" className="text-primary underline underline-offset-2">
                  Add a client first
                </Link>{" "}
                before creating a booking.
              </p>
            ) : (
              <>
                <Select
                  id="clientId"
                  value={form.clientId}
                  onChange={(e) => set("clientId", e.target.value)}
                  aria-invalid={invalid("clientId")}
                  aria-describedby={describedBy("clientId")}
                >
                  <option value="">Select a client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <FieldError id="clientId-error" message={errors.clientId} />
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="destination">
              Destination
              <RequiredMark />
            </Label>
            <Input
              id="destination"
              value={form.destination}
              onChange={(e) => set("destination", e.target.value)}
              placeholder="e.g. Dubai, UAE"
              aria-invalid={invalid("destination")}
              aria-describedby={describedBy("destination")}
            />
            <FieldError id="destination-error" message={errors.destination} />
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

          {mode === "create" && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="lead">Lead traveller</Label>
              <Input
                id="lead"
                value={form.leadTravellerName}
                onChange={(e) => set("leadTravellerName", e.target.value)}
                placeholder="Full name"
                aria-describedby="lead-help"
              />
              <p id="lead-help" className="text-muted-foreground text-xs">
                Optional — you can add passport details and more travellers next.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- Dates ------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dates</CardTitle>
          <CardDescription>Departure and return set the itinerary length.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="departDate">
              Depart date
              <RequiredMark />
            </Label>
            <Input
              id="departDate"
              type="date"
              value={form.departDate}
              onChange={(e) => set("departDate", e.target.value)}
              className="tabular-nums"
              aria-invalid={invalid("departDate")}
              aria-describedby={describedBy("departDate")}
            />
            <FieldError id="departDate-error" message={errors.departDate} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="returnDate">
              Return date
              <RequiredMark />
            </Label>
            <Input
              id="returnDate"
              type="date"
              value={form.returnDate}
              min={form.departDate || undefined}
              onChange={(e) => set("returnDate", e.target.value)}
              className="tabular-nums"
              aria-invalid={invalid("returnDate")}
              aria-describedby={describedBy("returnDate", "help")}
            />
            <FieldError id="returnDate-error" message={errors.returnDate} />
            {!errors.returnDate && (
              <p id="returnDate-help" className="text-muted-foreground text-xs">
                Must be on or after the departure date.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* --- Commercial -------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commercial</CardTitle>
          <CardDescription>Pricing currency and internal notes.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select
              id="currency"
              value={form.currency}
              onChange={(e) => set("currency", e.target.value)}
              aria-describedby="currency-help"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <p id="currency-help" className="text-muted-foreground text-xs">
              All amounts on this booking use this currency. Default is {DEFAULT_CURRENCY}.
            </p>
          </div>

          {mode === "edit" && (
            <div className="space-y-2">
              <Label htmlFor="depositPercent">Deposit required (%)</Label>
              <Input
                id="depositPercent"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={form.depositPercent}
                onChange={(e) => set("depositPercent", e.target.value)}
                placeholder={
                  agencyDepositPercent === undefined
                    ? undefined
                    : String(agencyDepositPercent)
                }
                aria-describedby="depositPercent-help"
                className="tabular-nums"
              />
              <p id="depositPercent-help" className="text-muted-foreground text-xs">
                Share of the total that confirms this booking.
                {agencyDepositPercent === undefined
                  ? " Leave empty to use the agency default."
                  : ` Leave empty to use the agency default (${agencyDepositPercent}%).`}
              </p>
            </div>
          )}

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              placeholder="Internal notes visible to your team."
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || noClients}>
          {pending ? "Saving…" : mode === "create" ? "Create booking" : "Save changes"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
