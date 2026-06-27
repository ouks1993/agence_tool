"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { recordCommission } from "@/lib/actions/commissions";
import {
  COMMISSION_BASES,
  COMMISSION_STATUSES,
  COMMISSION_STATUS_META,
  COMMISSION_TYPE_LABEL,
  COMMISSION_TYPES,
  SUPPORTED_CURRENCIES,
  type CommissionBasis,
  type CommissionStatus,
  type CommissionType,
} from "@/lib/domain";

/** Initial form state — recreated each time the dialog opens. */
function emptyForm(presetBookingId: string | null) {
  return {
    type: "supplier_to_agency" as CommissionType,
    bookingRef: "",
    amount: "",
    currency: "DZD" as (typeof SUPPORTED_CURRENCIES)[number],
    basis: "percent" as CommissionBasis,
    rate: "",
    baseAmount: "",
    status: "pending" as CommissionStatus,
    note: "",
    // When opened from a booking workspace we already know the booking id, so we
    // pass it straight through and hide the free-text reference field.
    bookingId: presetBookingId,
  };
}

export function RecordCommissionDialog({
  bookingId = null,
  trigger,
}: {
  /** When set, the commission is attached to this booking and the ref field is hidden. */
  bookingId?: string | null;
  /** Optional custom trigger; defaults to an "Add commission" button. */
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(() => emptyForm(bookingId));

  // Reset the form whenever the dialog transitions open so stale input never
  // lingers between submissions.
  const onOpenChange = (next: boolean) => {
    if (next) setForm(emptyForm(bookingId));
    setOpen(next);
  };

  const save = () => {
    const amount = Number(form.amount);
    if (!form.amount || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    startTransition(async () => {
      // Spread optional fields so we never pass `undefined` explicitly — keeps
      // the input compatible with exactOptionalPropertyTypes.
      const res = await recordCommission({
        type: form.type,
        amount,
        currency: form.currency,
        basis: form.basis,
        status: form.status,
        ...(form.bookingId && { bookingId: form.bookingId }),
        ...(form.bookingRef.trim() && { bookingRef: form.bookingRef.trim() }),
        ...(form.rate && { rate: Number(form.rate) }),
        ...(form.baseAmount && { baseAmount: Number(form.baseAmount) }),
        ...(form.note.trim() && { note: form.note.trim() }),
      });

      if (res.ok) {
        toast.success("Commission recorded");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="mr-2 size-4" />
            Add commission
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record commission</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="cm-type">Type</Label>
            <Select
              id="cm-type"
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({ ...f, type: e.target.value as CommissionType }))
              }
            >
              {COMMISSION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {COMMISSION_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </div>

          {!form.bookingId && (
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="cm-ref">Booking ref</Label>
              <Input
                id="cm-ref"
                value={form.bookingRef}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bookingRef: e.target.value }))
                }
                placeholder="e.g. BK-2026-0142"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cm-amount">Amount</Label>
            <Input
              id="cm-amount"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cm-currency">Currency</Label>
            <Select
              id="cm-currency"
              value={form.currency}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  currency: e.target.value as (typeof SUPPORTED_CURRENCIES)[number],
                }))
              }
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cm-basis">Basis</Label>
            <Select
              id="cm-basis"
              value={form.basis}
              onChange={(e) =>
                setForm((f) => ({ ...f, basis: e.target.value as CommissionBasis }))
              }
            >
              {COMMISSION_BASES.map((b) => (
                <option key={b} value={b}>
                  {b === "percent" ? "Percent" : "Fixed"}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cm-status">Status</Label>
            <Select
              id="cm-status"
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as CommissionStatus }))
              }
            >
              {COMMISSION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {COMMISSION_STATUS_META[s].label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cm-rate">Rate %</Label>
            <Input
              id="cm-rate"
              type="number"
              min="0"
              step="0.01"
              value={form.rate}
              onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
              placeholder="optional"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cm-base">Base amount</Label>
            <Input
              id="cm-base"
              type="number"
              min="0"
              step="0.01"
              value={form.baseAmount}
              onChange={(e) =>
                setForm((f) => ({ ...f, baseAmount: e.target.value }))
              }
              placeholder="optional"
            />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="cm-note">Note</Label>
            <Textarea
              id="cm-note"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Optional context for this commission"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !form.amount}>
            {pending ? "Saving…" : "Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
