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
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AiQuoteBuilder } from "@/components/products/ai-quote-builder";
import { SupplierPicker, type SupplierOption } from "@/components/suppliers/supplier-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { QuoteResult } from "@/lib/actions/ai";
import {
  addProductItem,
  applyMarginToAllItems,
  removeProductItem,
  updateProductItemPricing,
} from "@/lib/actions/products";
import {
  PRODUCT_ITEM_TYPES,
  PRODUCT_ITEM_TYPE_META,
  type ProductItemType,
} from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import {
  marginFromCostPrice,
  priceFromMargin,
  round2,
  toNumber,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

const ICONS: Record<ProductItemType, React.ComponentType<{ className?: string }>> = {
  flight: Plane,
  hotel: BedDouble,
  activity: Ticket,
  transfer: Car,
  insurance: ShieldCheck,
  other: Package,
};

// Per-category tile colours, drawn from the design-system tokens so the proposal
// line items match the marketing mockup (flights · hotels · activities · … ).
const TILE: Record<ProductItemType, string> = {
  flight: "bg-brand/10 text-brand",
  hotel: "bg-success-soft text-success",
  activity: "bg-chart-4/10 text-chart-4",
  transfer: "bg-info-soft text-info",
  insurance: "bg-warning-soft text-warning",
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
  startDate: Date | string | null;
};

type AddForm = {
  type: ProductItemType;
  title: string;
  supplier: string;
  supplierId: string | null;
  quantity: string;
  unitCost: string;
  description: string;
  startDate: string;
};

const emptyForm = (type: ProductItemType = "activity"): AddForm => ({
  type,
  title: "",
  supplier: "",
  supplierId: null,
  quantity: "1",
  unitCost: "",
  description: "",
  startDate: "",
});

/**
 * Compact two-way pricing editor for one line-item row.
 *
 * Stored truth is cost + price. Margin is a derived *input device*: typing a
 * margin recomputes the price; editing the price re-derives the margin readout
 * (cost 0 → "—"). Local edits are committed on blur/Enter, and only when a value
 * actually changed, so browsing a proposal never fires writes. `unitCost` /
 * `unitPrice` from the server are the source of truth whenever they change.
 */
function PricingRow({
  item,
  disabled,
  onSave,
}: {
  item: ProductItemRow;
  disabled: boolean;
  onSave: (pricing: {
    unitCost: number;
    unitPrice: number;
    quantity: number;
  }) => void;
}) {
  // Editable draft strings for cost + price. Local draft of the margin input is
  // a string so the field can be cleared/typed freely; `null` means "track the
  // derived margin" (i.e. show margin computed from the current cost/price).
  const [cost, setCost] = useState(item.unitCost);
  const [price, setPrice] = useState(item.unitPrice);
  const [marginDraft, setMarginDraft] = useState<string | null>(null);
  // Re-seed drafts from the server whenever the persisted values change (e.g. an
  // apply-to-all rewrite or a router refresh). Derived-state-from-props pattern:
  // a render-phase setState is the React-sanctioned way to reset on prop change.
  const [synced, setSynced] = useState({
    cost: item.unitCost,
    price: item.unitPrice,
  });
  if (synced.cost !== item.unitCost || synced.price !== item.unitPrice) {
    setCost(item.unitCost);
    setPrice(item.unitPrice);
    setMarginDraft(null);
    setSynced({ cost: item.unitCost, price: item.unitPrice });
  }

  const costNum = toNumber(cost);
  const priceNum = toNumber(price);
  const derivedMargin = marginFromCostPrice(costNum, priceNum);

  const marginValue =
    marginDraft ??
    (derivedMargin === null ? "" : String(round2(derivedMargin)));

  const commit = (next: { cost: number; price: number }) => {
    // Only write when something actually changed vs the last server sync.
    if (
      round2(next.cost) === round2(toNumber(synced.cost)) &&
      round2(next.price) === round2(toNumber(synced.price))
    ) {
      return;
    }
    onSave({ unitCost: next.cost, unitPrice: next.price, quantity: item.quantity });
  };

  const onMarginChange = (raw: string) => {
    setMarginDraft(raw);
    // Typing a margin recomputes the price live (cost is unchanged).
    const m = raw === "" ? 0 : Number(raw);
    if (Number.isFinite(m)) {
      setPrice(String(priceFromMargin(costNum, m)));
    }
  };

  const linePrice = priceNum * item.quantity;

  return (
    <div className="flex shrink-0 items-start gap-2">
      <div className="flex flex-col items-end gap-1">
        {/* Editable cost + price + margin, kept on one compact line. */}
        <div className="flex items-center gap-1.5">
          <label className="sr-only" htmlFor={`cost-${item.id}`}>
            Net cost
          </label>
          <Input
            id={`cost-${item.id}`}
            type="number"
            min="0"
            step="0.01"
            value={cost}
            disabled={disabled}
            onChange={(e) => {
              setCost(e.target.value);
              // Cost change keeps the current margin: recompute price from the
              // current margin draft/derived value so margin stays put.
              const m = marginDraft ?? (derivedMargin === null ? "0" : String(derivedMargin));
              const mn = m === "" ? 0 : Number(m);
              if (Number.isFinite(mn)) {
                setPrice(String(priceFromMargin(toNumber(e.target.value), mn)));
              }
            }}
            onBlur={() => commit({ cost: toNumber(cost), price: toNumber(price) })}
            className="h-7 w-20 text-right text-xs tabular-nums"
            aria-label="Net cost"
          />
          <span className="text-muted-foreground text-xs">→</span>
          <div className="relative">
            <Input
              type="number"
              min="0"
              step="0.5"
              value={marginValue}
              disabled={disabled || costNum === 0}
              placeholder={costNum === 0 ? "—" : "0"}
              onChange={(e) => onMarginChange(e.target.value)}
              onBlur={() => {
                setMarginDraft(null);
                commit({ cost: costNum, price: toNumber(price) });
              }}
              className="h-7 w-16 pr-4 text-right text-xs tabular-nums"
              aria-label="Margin percent"
            />
            <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-xs">
              %
            </span>
          </div>
          <label className="sr-only" htmlFor={`price-${item.id}`}>
            Sell price
          </label>
          <Input
            id={`price-${item.id}`}
            type="number"
            min="0"
            step="0.01"
            value={price}
            disabled={disabled}
            onChange={(e) => {
              setPrice(e.target.value);
              setMarginDraft(null); // fall back to derived margin from the new price
            }}
            onBlur={() => commit({ cost: costNum, price: toNumber(price) })}
            className="h-7 w-24 text-right text-xs font-semibold tabular-nums"
            aria-label="Sell price"
          />
        </div>
        {item.quantity > 1 && (
          <p className="text-muted-foreground text-xs tabular-nums">
            {formatMoney(linePrice, item.currency)} for ×{item.quantity}
          </p>
        )}
      </div>
    </div>
  );
}

export function ItemsManager({
  productId,
  currency,
  items,
  suppliers = [],
  defaultMarginPercent = 0,
}: {
  productId: string;
  currency: string;
  items: ProductItemRow[];
  suppliers?: SupplierOption[];
  // The proposal's default margin (`markupPercent`) — seeds the apply-to-all
  // input and is applied to newly added items server-side.
  defaultMarginPercent?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AddForm>(emptyForm());
  const [titleError, setTitleError] = useState(false);
  // Apply-to-all margin input, seeded from the proposal default. Explicit action
  // only — typing here never touches items until "Apply to all" is pressed.
  const [bulkMargin, setBulkMargin] = useState(String(defaultMarginPercent));

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

  const openAdd = (type: ProductItemType) => {
    setForm(emptyForm(type));
    setTitleError(false);
    setOpen(true);
  };

  const add = () => {
    if (!form.title.trim()) {
      setTitleError(true);
      return;
    }
    startTransition(async () => {
      const res = await addProductItem(productId, {
        type: form.type,
        title: form.title.trim(),
        supplier: form.supplier || undefined,
        supplierId: form.supplierId ?? undefined,
        quantity: form.quantity === "" ? 1 : Number(form.quantity),
        unitCost: form.unitCost === "" ? 0 : Number(form.unitCost),
        currency,
        description: form.description || undefined,
        startDate: form.startDate || undefined,
      });
      if (res.ok) {
        toast.success("Item added");
        setForm(emptyForm(form.type));
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  // Bulk-add AI-generated line items into the proposal in place.
  const applyQuote = (quote: QuoteResult) => {
    startTransition(async () => {
      let added = 0;
      for (const it of quote.items) {
        const res = await addProductItem(productId, {
          type: it.type,
          title: it.title,
          supplier: it.supplier || undefined,
          quantity: it.quantity,
          unitCost: it.unitCost,
          currency,
        });
        if (res.ok) added += 1;
      }
      if (added > 0) {
        toast.success(`${added} item${added === 1 ? "" : "s"} added from AI`);
        router.refresh();
      } else {
        toast.error("Could not add the generated items.");
      }
    });
  };

  // Persist a single row's resolved cost/price/qty (the row editor turns the
  // typed margin into a price before calling this).
  const saveItemPricing = (
    itemId: string,
    pricing: { unitCost: number; unitPrice: number; quantity: number }
  ) => {
    startTransition(async () => {
      const res = await updateProductItemPricing(itemId, pricing);
      if (res.ok) {
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  // Explicit "apply to all": rewrite every item's price from its own cost at one
  // margin. Zero-cost items are skipped server-side. Fired only on button press.
  const applyToAll = () => {
    const margin = bulkMargin === "" ? 0 : Number(bulkMargin);
    startTransition(async () => {
      const res = await applyMarginToAllItems(productId, { marginPercent: margin });
      if (res.ok) {
        toast.success(`Applied ${round2(margin)}% margin to all items`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const totals = items.reduce(
    (acc, it) => {
      const q = it.quantity;
      acc.cost += toNumber(it.unitCost) * q;
      acc.sell += toNumber(it.unitPrice) * q;
      return acc;
    },
    { cost: 0, sell: 0 }
  );
  const margin = totals.sell - totals.cost;
  const marginPct = totals.cost > 0 ? (margin / totals.cost) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Header: AI generate chip */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Build the itinerary line by line, or generate it with AI.
        </p>
        <AiQuoteBuilder
          onQuote={applyQuote}
          trigger={
            <Button
              type="button"
              size="sm"
              className="from-chart-4 to-primary bg-gradient-to-br text-white shadow-sm hover:opacity-95"
            >
              <Sparkles className="mr-2 size-4" />
              Generate with AI
            </Button>
          }
        />
      </div>

      {items.length === 0 ? (
        <button
          type="button"
          onClick={() => openAdd("flight")}
          className="border-border hover:border-primary hover:bg-accent text-muted-foreground hover:text-accent-foreground flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-8 text-sm transition-colors"
        >
          <Plus className="size-5" />
          <span className="font-medium">Add your first line item</span>
          <span className="text-xs">Flights, hotels, transfers, activities…</span>
        </button>
      ) : (
        <>
          <div className="space-y-4">
            {PRODUCT_ITEM_TYPES.map((type) => {
              const rows = items.filter((i) => i.type === type);
              if (rows.length === 0) return null;
              const Icon = ICONS[type];
              return (
                <section key={type} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-md",
                        TILE[type]
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <h3 className="text-sm font-semibold">
                      {PRODUCT_ITEM_TYPE_META[type].label}
                    </h3>
                    <span className="text-muted-foreground text-xs">
                      · {rows.length}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-7"
                      onClick={() => openAdd(type)}
                    >
                      <Plus className="mr-1 size-3.5" />
                      Add {PRODUCT_ITEM_TYPE_META[type].label.toLowerCase()}
                    </Button>
                  </div>
                  <ul className="divide-y rounded-lg border">
                    {rows.map((item) => {
                      return (
                        <li
                          key={item.id}
                          className="flex items-start gap-3 px-3 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{item.title}</p>
                            <p className="text-muted-foreground text-xs">
                              {item.supplier ? `${item.supplier}` : ""}
                              {item.supplier && item.quantity > 1 ? " · " : ""}
                              {item.quantity > 1 ? `×${item.quantity}` : ""}
                              {item.startDate
                                ? `${item.supplier || item.quantity > 1 ? " · " : ""}${formatDate(item.startDate)}`
                                : ""}
                            </p>
                            {item.description && (
                              <p className="text-muted-foreground mt-0.5 text-xs">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <PricingRow
                            item={item}
                            disabled={pending}
                            onSave={(pricing) =>
                              saveItemPricing(item.id, pricing)
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
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
                </section>
              );
            })}
          </div>

          {/* Apply-to-all margin — explicit action; rewrites every item's price
              from its own cost at this one margin. Zero-cost items are skipped. */}
          <div className="border-strong flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3 text-sm">
            <span className="text-muted-foreground">Set one margin for all items</span>
            <div className="relative ml-auto">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={bulkMargin}
                onChange={(e) => setBulkMargin(e.target.value)}
                className="h-8 w-24 pr-6 text-right tabular-nums"
                aria-label="Margin percent for all items"
              />
              <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs">
                %
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyToAll}
              disabled={pending}
            >
              Apply to all items
            </Button>
          </div>

          {/* Quote summary */}
          <div className="border-strong bg-surface-2 space-y-1.5 rounded-lg border p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total cost</span>
              <span className="tabular-nums">
                {formatMoney(totals.cost, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Margin</span>
              <span className="inline-flex items-center gap-2">
                {marginPct > 0 && (
                  <span className="bg-success-soft text-success rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums">
                    {marginPct.toFixed(0)}%
                  </span>
                )}
                <span className="text-success tabular-nums">
                  {formatMoney(margin, currency)}
                </span>
              </span>
            </div>
            <div className="flex justify-between border-t pt-1.5 font-semibold">
              <span>Total sell</span>
              <span className="text-base tabular-nums">
                {formatMoney(totals.sell, currency)}
              </span>
            </div>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={() => openAdd("activity")}>
            <Plus className="mr-2 size-4" />
            Add line item
          </Button>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
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
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value as ProductItemType }))
                }
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
              <Label htmlFor="i-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="i-title"
                value={form.title}
                onChange={(e) => {
                  setForm((f) => ({ ...f, title: e.target.value }));
                  if (titleError) setTitleError(false);
                }}
                aria-invalid={titleError || undefined}
                placeholder="e.g. Airport transfer, City tour…"
              />
              {titleError && (
                <p className="text-destructive text-xs">A title is required.</p>
              )}
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
            <div className="space-y-2">
              <Label htmlFor="i-date">Date</Label>
              <Input
                id="i-date"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
              <p className="text-muted-foreground text-xs">
                Dated items form the day-by-day itinerary.
              </p>
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
            <Button onClick={add} disabled={pending}>
              {pending ? "Adding…" : "Add item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
