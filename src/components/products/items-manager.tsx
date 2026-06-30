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
import { SupplierPicker, type SupplierOption } from "@/components/suppliers/supplier-picker";
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
import { cn } from "@/lib/utils";

const ICONS: Record<ProductItemType, React.ComponentType<{ className?: string }>> = {
  flight: Plane,
  hotel: BedDouble,
  activity: Ticket,
  transfer: Car,
  insurance: ShieldCheck,
  other: Package,
};

// Per-category tile colours, drawn from the design-system chart palette so the
// proposal line items match the marketing mockup (flights · hotels · activities
// · transfers · insurance).
const TILE: Record<ProductItemType, string> = {
  flight: "bg-brand/10 text-brand",
  hotel: "bg-green-500/10 text-green-600 dark:text-green-400",
  activity: "bg-chart-4/10 text-chart-4",
  transfer: "bg-chart-6/10 text-chart-6",
  insurance: "bg-chart-3/10 text-chart-3",
  other: "bg-muted text-muted-foreground",
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
  suppliers = [],
}: {
  productId: string;
  currency: string;
  items: ProductItemRow[];
  suppliers?: SupplierOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: "activity",
    title: "",
    supplier: "",
    supplierId: null as string | null,
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
        supplier: form.supplier || undefined,
        supplierId: form.supplierId ?? undefined,
        quantity: form.quantity === "" ? 1 : Number(form.quantity),
        unitCost: form.unitCost === "" ? 0 : Number(form.unitCost),
        currency,
        description: form.description,
      });
      if (res.ok) {
        toast.success("Item added");
        setForm({ type: "activity", title: "", supplier: "", supplierId: null, quantity: "1", unitCost: "", description: "" });
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const totals = items.reduce(
    (acc, it) => {
      const q = it.quantity;
      acc.cost += parseFloat(it.unitCost || "0") * q;
      acc.sell += parseFloat(it.unitPrice || "0") * q;
      return acc;
    },
    { cost: 0, sell: 0 }
  );
  const margin = totals.sell - totals.cost;
  const marginPct = totals.cost > 0 ? (margin / totals.cost) * 100 : 0;

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No items yet. Add flights and hotels from{" "}
          <span className="font-medium">Search</span>, or add a line item below.
        </p>
      ) : (
        <>
          <ul className="divide-y">
            {items.map((item) => {
              const Icon = ICONS[(item.type as ProductItemType)] ?? Package;
              const lineCost = parseFloat(item.unitCost || "0") * item.quantity;
              const linePrice = parseFloat(item.unitPrice || "0") * item.quantity;
              const lineMargin = linePrice - lineCost;
              return (
                <li key={item.id} className="flex items-start gap-3 py-3">
                  <div
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
                      TILE[item.type as ProductItemType] ??
                        "bg-muted text-muted-foreground"
                    )}
                  >
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
                    <p className="font-semibold tabular-nums">
                      {formatMoney(linePrice, item.currency)}
                    </p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      cost {formatMoney(lineCost, item.currency)}
                      {lineMargin > 0 && (
                        <span className="text-green-600 dark:text-green-400">
                          {" · +"}
                          {formatMoney(lineMargin, item.currency)}
                        </span>
                      )}
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

          <div className="space-y-1.5 rounded-lg border bg-muted/30 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total cost</span>
              <span className="tabular-nums">{formatMoney(totals.cost, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Margin{marginPct > 0 ? ` · ${marginPct.toFixed(0)}%` : ""}
              </span>
              <span className="tabular-nums text-green-600 dark:text-green-400">
                {formatMoney(margin, currency)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-1.5 font-semibold">
              <span>Total sell</span>
              <span className="text-base tabular-nums">
                {formatMoney(totals.sell, currency)}
              </span>
            </div>
          </div>
        </>
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
              <SupplierPicker
                id="i-supplier"
                suppliers={suppliers}
                value={form.supplier}
                supplierId={form.supplierId}
                onChange={(name, id) =>
                  setForm((f) => ({ ...f, supplier: name, supplierId: id }))
                }
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
