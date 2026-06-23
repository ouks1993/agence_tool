"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, CreditCard, Link2 } from "lucide-react";
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
import { recordPayment, deletePayment, createPaymentLink } from "@/lib/actions/payments";
import { PAYMENT_KINDS, PAYMENT_KIND_LABEL, PAYMENT_METHODS } from "@/lib/domain";
import { formatMoney, formatDate } from "@/lib/format";

export type PaymentRow = {
  id: string;
  amount: string;
  currency: string;
  kind: string;
  method: string;
  status: string;
  reference: string | null;
  note: string | null;
  createdAt: string | Date;
};

export function PaymentsManager({
  bookingId,
  currency,
  payments,
  balance,
  stripeConfigured,
}: {
  bookingId: string;
  currency: string;
  payments: PaymentRow[];
  balance: number;
  stripeConfigured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    amount: balance > 0 ? String(balance) : "",
    kind: "deposit",
    method: "manual",
    reference: "",
    note: "",
  });

  const record = () => {
    startTransition(async () => {
      const res = await recordPayment(bookingId, {
        amount: form.amount === "" ? 0 : Number(form.amount),
        kind: form.kind as "deposit" | "installment" | "payment" | "refund",
        method: form.method as "manual" | "card" | "transfer" | "cash" | "stripe",
        reference: form.reference,
        note: form.note,
      });
      if (res.ok) {
        toast.success("Payment recorded");
        setForm({ amount: "", kind: "payment", method: "manual", reference: "", note: "" });
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const res = await deletePayment(id, bookingId);
      if (res.ok) {
        toast.success("Payment removed");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const stripeLink = () => {
    startTransition(async () => {
      const res = await createPaymentLink(bookingId, balance > 0 ? balance : 0);
      if (res.ok && res.data) {
        await navigator.clipboard.writeText(res.data.url).catch(() => {});
        toast.success("Payment link created & copied", {
          action: { label: "Open", onClick: () => window.open(res.data!.url, "_blank") },
        });
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-3">
      {payments.length === 0 ? (
        <p className="text-muted-foreground text-sm">No payments recorded yet.</p>
      ) : (
        <ul className="divide-y">
          {payments.map((p) => {
            const isRefund = p.kind === "refund";
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {PAYMENT_KIND_LABEL[p.kind as keyof typeof PAYMENT_KIND_LABEL] ?? p.kind}
                    <span className="text-muted-foreground ml-2 text-xs capitalize">
                      {p.method}
                    </span>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatDate(p.createdAt)}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      isRefund
                        ? "font-semibold text-red-600 dark:text-red-400"
                        : "font-semibold text-green-600 dark:text-green-400"
                    }
                  >
                    {isRefund ? "−" : "+"}
                    {formatMoney(p.amount, p.currency)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(p.id)}
                    disabled={pending}
                    aria-label="Remove payment"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="mr-2 size-4" />
              Record payment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record payment</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-amount">Amount ({currency})</Label>
                <Input
                  id="p-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-kind">Type</Label>
                <Select
                  id="p-kind"
                  value={form.kind}
                  onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
                >
                  {PAYMENT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {PAYMENT_KIND_LABEL[k]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-method">Method</Label>
                <Select
                  id="p-method"
                  value={form.method}
                  onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m} className="capitalize">
                      {m}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-ref">Reference</Label>
                <Input
                  id="p-ref"
                  value={form.reference}
                  onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="p-note">Note</Label>
                <Input
                  id="p-note"
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={record} disabled={pending || !form.amount}>
                {pending ? "Saving…" : "Record"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {stripeConfigured && balance > 0 && (
          <Button variant="outline" size="sm" onClick={stripeLink} disabled={pending}>
            <Link2 className="mr-2 size-4" />
            Stripe payment link
          </Button>
        )}
        {!stripeConfigured && (
          <span className="text-muted-foreground inline-flex items-center gap-1 self-center text-xs">
            <CreditCard className="size-3.5" /> Add STRIPE_SECRET_KEY for card links
          </span>
        )}
      </div>
    </div>
  );
}
