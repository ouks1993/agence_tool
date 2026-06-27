"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import {
  createSupplierContract,
  updateSupplierContract,
  type SupplierContractInput,
} from "@/lib/actions/suppliers";
import {
  CONTRACT_BASES,
  CONTRACT_BASIS_LABEL,
  CONTRACT_STATUS_META,
  CONTRACT_STATUSES,
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCIES,
} from "@/lib/domain";

type Props = {
  supplierId: string;
  /** When provided, the dialog edits this contract instead of creating one. */
  contractId?: string;
  defaultValues?: Partial<SupplierContractInput>;
  /** The trigger element (e.g. a Button). */
  trigger: React.ReactNode;
};

/** Local form state uses strings for numeric/date inputs — converted on submit. */
type FormState = {
  supplierId: string;
  name: string;
  reference: string;
  commissionBasis: SupplierContractInput["commissionBasis"];
  commissionRate: string;
  currency: SupplierContractInput["currency"];
  validFrom: string;
  validTo: string;
  status: SupplierContractInput["status"];
  notes: string;
};

/** Normalize a Date | string | undefined to a yyyy-mm-dd string for <input type="date">. */
function toDateInput(value: Date | string | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function ContractDialog({
  supplierId,
  contractId,
  defaultValues,
  trigger,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const mode = contractId ? "edit" : "create";

  const [form, setForm] = useState<FormState>({
    supplierId,
    name: defaultValues?.name ?? "",
    reference: defaultValues?.reference ?? "",
    commissionBasis: defaultValues?.commissionBasis ?? "percent",
    commissionRate: defaultValues?.commissionRate != null ? String(defaultValues.commissionRate) : "",
    currency: defaultValues?.currency ?? DEFAULT_CURRENCY,
    validFrom: toDateInput(defaultValues?.validFrom),
    validTo: toDateInput(defaultValues?.validTo),
    status: defaultValues?.status ?? "active",
    notes: defaultValues?.notes ?? "",
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // A net-rate contract carries no commission percentage/amount of its own.
  const showRate = form.commissionBasis !== "net";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const payload: SupplierContractInput = {
        ...form,
        commissionRate: form.commissionRate ? Number(form.commissionRate) : undefined,
        validFrom: form.validFrom ? new Date(form.validFrom) : undefined,
        validTo: form.validTo ? new Date(form.validTo) : undefined,
      };
      const res =
        mode === "create"
          ? await createSupplierContract(payload)
          : await updateSupplierContract(contractId!, payload);
      if (res.ok) {
        toast.success(mode === "create" ? "Contract added" : "Contract updated");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Add contract" : "Edit contract"}
            </DialogTitle>
            <DialogDescription>
              Commission terms and validity for this supplier.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="contract-name">Name *</Label>
              <Input
                id="contract-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="2026 commission agreement"
                required
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="contract-reference">Reference</Label>
              <Input
                id="contract-reference"
                value={form.reference}
                onChange={(e) => set("reference", e.target.value)}
                placeholder="Contract number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract-basis">Commission basis</Label>
              <Select
                id="contract-basis"
                value={form.commissionBasis}
                onChange={(e) =>
                  set(
                    "commissionBasis",
                    e.target.value as SupplierContractInput["commissionBasis"]
                  )
                }
              >
                {CONTRACT_BASES.map((b) => (
                  <option key={b} value={b}>
                    {CONTRACT_BASIS_LABEL[b]}
                  </option>
                ))}
              </Select>
            </div>

            {showRate && (
              <div className="space-y-2">
                <Label htmlFor="contract-rate">
                  {form.commissionBasis === "percent" ? "Rate (%)" : "Amount"}
                </Label>
                <Input
                  id="contract-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.commissionRate ?? ""}
                  onChange={(e) => set("commissionRate", e.target.value)}
                  placeholder={form.commissionBasis === "percent" ? "10" : "50"}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="contract-currency">Currency</Label>
              <Select
                id="contract-currency"
                value={form.currency}
                onChange={(e) =>
                  set("currency", e.target.value as SupplierContractInput["currency"])
                }
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract-status">Status</Label>
              <Select
                id="contract-status"
                value={form.status}
                onChange={(e) =>
                  set("status", e.target.value as SupplierContractInput["status"])
                }
              >
                {CONTRACT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CONTRACT_STATUS_META[s].label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract-from">Valid from</Label>
              <Input
                id="contract-from"
                type="date"
                value={toDateInput(form.validFrom)}
                onChange={(e) => set("validFrom", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contract-to">Valid to</Label>
              <Input
                id="contract-to"
                type="date"
                value={toDateInput(form.validTo)}
                onChange={(e) => set("validTo", e.target.value)}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="contract-notes">Notes</Label>
              <Textarea
                id="contract-notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : mode === "create" ? "Add contract" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
