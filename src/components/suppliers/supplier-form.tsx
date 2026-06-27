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
import { CityInput } from "@/components/reference/city-input";
import { CountryCombobox } from "@/components/reference/country-combobox";
import {
  createSupplier,
  updateSupplier,
  type SupplierInput,
} from "@/lib/actions/suppliers";
import {
  SUPPLIER_STATUSES,
  SUPPLIER_STATUS_META,
  SUPPLIER_TYPES,
  SUPPLIER_TYPE_META,
} from "@/lib/domain";

type Props = {
  mode: "create" | "edit";
  supplierId?: string;
  defaultValues?: Partial<SupplierInput>;
};

export function SupplierForm({ mode, supplierId, defaultValues }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<SupplierInput>({
    name: defaultValues?.name ?? "",
    type: (defaultValues?.type as SupplierInput["type"]) ?? "hotel",
    status: (defaultValues?.status as SupplierInput["status"]) ?? "active",
    email: defaultValues?.email ?? "",
    phone: defaultValues?.phone ?? "",
    website: defaultValues?.website ?? "",
    contactName: defaultValues?.contactName ?? "",
    address: defaultValues?.address ?? "",
    city: defaultValues?.city ?? "",
    country: defaultValues?.country ?? "",
    notes: defaultValues?.notes ?? "",
  });

  const set = <K extends keyof SupplierInput>(key: K, value: SupplierInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createSupplier(form)
          : await updateSupplier(supplierId!, form);
      if (res.ok) {
        toast.success(mode === "create" ? "Supplier created" : "Supplier updated");
        const id = mode === "create" && "data" in res ? res.data?.id : supplierId;
        router.push(id ? `/suppliers/${id}` : "/suppliers");
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
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Supplier name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select
              id="type"
              value={form.type}
              onChange={(e) => set("type", e.target.value as SupplierInput["type"])}
            >
              {SUPPLIER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SUPPLIER_TYPE_META[t].label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              value={form.status}
              onChange={(e) => set("status", e.target.value as SupplierInput["status"])}
            >
              {SUPPLIER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {SUPPLIER_STATUS_META[s].label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="contact@supplier.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+33 1 23 45 67 89"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://supplier.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactName">Contact name</Label>
            <Input
              id="contactName"
              value={form.contactName}
              onChange={(e) => set("contactName", e.target.value)}
              placeholder="Account manager"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <CityInput id="city" value={form.city ?? ""} onChange={(v) => set("city", v)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <CountryCombobox id="country" value={form.country ?? ""} onChange={(v) => set("country", v)} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={4}
              placeholder="Booking instructions, payment terms, history…"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create supplier" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
