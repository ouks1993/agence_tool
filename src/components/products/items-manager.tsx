"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plane,
  BedDouble,
  Ticket,
  Car,
  ShieldCheck,
  Package,
  Trash2,
  Plus,
} from "lucide-react";
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
import { addProductItem, removeProductItem } from "@/lib/actions/products";
import {
  PRODUCT_ITEM_TYPES,
  PRODUCT_ITEM_TYPE_META,
  type ProductItemType,
} from "@/lib/domain";
import { formatMoney } from "@/lib/format";

const ICONS: Record<ProductItemType, React.ComponentType<{ className?: string }>> = {
  flight: Plane,
  hotel: BedDouble,
  activity: Ticket,
  transfer: Car,
  insurance: ShieldCheck,
  other: Package,
};

export type ProductItemRow = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  supplier: string | null;
  quantity: number;
  unitCost: string;
  unitPrice: string;
  currency: string;
};

export function ItemsManager({
  productId,
  currency,
  items,
}: {
  productId: string;
  currency: string;
  items: ProductItemRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: "activity",
    title: "",
    supplier: "",
    quantity: "1",
    unitCost: "",
    description: "",
  });

  const remove = (id: string) => {
    startTransition(async () => {
      const res = await removeProductItem(id, productId);
      if (res.ok) {
        toast.success("Item removed");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const add = () => {
    startTransition(async () => {
      const res = await addProductItem(productId, {
        type: form.type as ProductItemType,
        title: form.title,
        supplier: form.supplier,
        quantity: form.quantity === "" ? 1 : Number(form.quantity),
        unitCost: form.unitCost === "" ? 0 : Number(form.unitCost),
        currency,
        description: form.description,
      });
      if (res.ok) {
        toast.success("Item added");
        setForm({ type: "activity", title: "", supplier: "", quantity: "1", unitCost: "", description: "" });
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No items yet. Add flights and hotels from{" "}
          <span className="font-medium">Search</span>, or add a line item below.
        </p>
      ) : (
        <ul className="divide-y">
          {items.map((item) => {
            const Icon = ICONS[(item.type as ProductItemType)] ?? Package;
            const lineCost = parseFloat(item.unitCost || "0") * item.quantity;
            const linePrice = parseFloat(item.unitPrice || "0") * item.quantity;
            return (
              <li key={item.id} className="flex items-start gap-3 py-3">
                <div className="bg-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {PRODUCT_ITEM_TYPE_META[item.type as ProductItemType]?.label ??
                      item.type}
                    {item.supplier ? ` · ${item.supplier}` : ""}
                    {item.quantity > 1 ? ` · ×${item.quantity}` : ""}
                  </p>
                  {item.description && (
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {item.description}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold">{formatMoney(linePrice, item.currency)}</p>
                  <p className="text-muted-foreground text-xs">
                    cost {formatMoney(lineCost, item.currency)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(item.id)}
                  disabled={pending}
                  aria-label="Remove item"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="mr-2 size-4" />
            Add line item
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add line item</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="i-type">Type</Label>
              <Select
                id="i-type"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                {PRODUCT_ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PRODUCT_ITEM_TYPE_META[t].label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="i-qty">Quantity</Label>
              <Input
                id="i-qty"
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="i-title">Title</Label>
              <Input
                id="i-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Airport transfer, City tour…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="i-supplier">Supplier</Label>
              <Input
                id="i-supplier"
                value={form.supplier}
                onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="i-cost">Net cost ({currency})</Label>
              <Input
                id="i-cost"
                type="number"
                min="0"
                step="0.01"
                value={form.unitCost}
                onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="i-desc">Description</Label>
              <Input
                id="i-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={add} disabled={pending || !form.title}>
              {pending ? "Adding…" : "Add item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
