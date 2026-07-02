"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { BookingSearchPanel } from "@/components/bookings/booking-search-panel";
import { BookingSegmentCard } from "@/components/bookings/booking-segment-cards";
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
import {
  addBookingItem,
  bookItem,
  removeBookingItem,
  updateBookingItemPricing,
} from "@/lib/actions/bookings";
import {
  BOOKING_ITEM_TYPE_META,
  TRAVEL_ITEM_TYPES,
  EXTRA_ITEM_TYPES,
  type BookingItemType,
} from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import {
  marginFromCostPrice,
  priceFromMargin,
  round2,
  toNumber,
} from "@/lib/pricing";

export type BookingItemRow = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  supplier: string | null;
  bookingRef: string | null;
  startDate: string | Date | null;
  endDate: string | Date | null;
  quantity: number;
  amount: string;
  /** Net supplier cost per unit; null = unknown (margin unknown). */
  unitCost: string | null;
  currency: string;
  itemStatus: string | null;
  confirmationNumber: string | null;
  /** Structured provider offer (FlightOffer/HotelOffer) when added from Search. */
  details: unknown;
};

export function BookingItemsManager({
  bookingId,
  currency,
  items,
  suppliers = [],
}: {
  bookingId: string;
  currency: string;
  items: BookingItemRow[];
  suppliers?: SupplierOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogTypes, setDialogTypes] = useState<BookingItemType[] | null>(null);
  const [tab, setTab] = useState<"search" | "manual">("search");
  const [form, setForm] = useState({
    type: "flight" as BookingItemType,
    title: "",
    supplier: "",
    supplierId: null as string | null,
    bookingRef: "",
    amount: "",
    unitCost: "",
    quantity: "1",
    startDate: "",
    endDate: "",
  });

  const travel = items.filter((i) =>
    TRAVEL_ITEM_TYPES.includes(i.type as BookingItemType)
  );
  const extras = items.filter((i) =>
    EXTRA_ITEM_TYPES.includes(i.type as BookingItemType)
  );

  const openDialog = (types: BookingItemType[]) => {
    setForm({
      type: types[0]!,
      title: "",
      supplier: "",
      supplierId: null,
      bookingRef: "",
      amount: "",
      unitCost: "",
      quantity: "1",
      startDate: "",
      endDate: "",
    });
    setTab("search");
    setDialogTypes(types);
  };

  // Called by the embedded search panel after an offer is added to this booking.
  const onSearchAdded = () => {
    setDialogTypes(null);
    router.refresh();
  };

  // Persist a single line's resolved cost/price/qty (the row editor turns the
  // typed margin into a sell price before calling this). Cost null = unknown.
  const savePricing = (
    id: string,
    pricing: { amount: number; unitCost: number | null; quantity: number }
  ) => {
    startTransition(async () => {
      const res = await updateBookingItemPricing(id, bookingId, pricing);
      if (res.ok) {
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const res = await removeBookingItem(id, bookingId);
      if (res.ok) {
        toast.success("Item removed");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  // Book a pending item with the supplier and store its confirmation number.
  const confirmItem = (id: string) => {
    startTransition(async () => {
      const res = await bookItem(id, bookingId);
      if (res.ok) {
        toast.success(`Confirmed: ${res.data?.confirmationNumber ?? ""}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const save = () => {
    startTransition(async () => {
      const res = await addBookingItem(bookingId, {
        type: form.type,
        title: form.title,
        supplier: form.supplier || undefined,
        supplierId: form.supplierId ?? undefined,
        bookingRef: form.bookingRef,
        amount: form.amount === "" ? 0 : Number(form.amount),
        // Empty cost = unknown (null), never a fake 0.
        unitCost: form.unitCost === "" ? null : Number(form.unitCost),
        quantity: form.quantity === "" ? 1 : Number(form.quantity),
        currency,
        startDate: form.startDate,
        endDate: form.endDate,
      });
      if (res.ok) {
        toast.success("Added");
        setDialogTypes(null);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const isTravelDialog =
    dialogTypes !== null && dialogTypes.some((t) => TRAVEL_ITEM_TYPES.includes(t));

  // Item-level margin readout: sum sell − cost ONLY over lines whose cost is
  // known (non-null) AND whose currency matches the booking (never mix
  // currencies). Lines with unknown cost or a foreign currency are excluded, so
  // the figure is honest. When nothing qualifies, we render no line at all.
  const costedItems = items.filter(
    (i) => i.unitCost != null && i.unitCost !== "" && i.currency === currency
  );
  const marginBase = costedItems.reduce(
    (acc, i) => {
      acc.sell += toNumber(i.amount) * i.quantity;
      acc.cost += toNumber(i.unitCost) * i.quantity;
      return acc;
    },
    { sell: 0, cost: 0 }
  );
  const itemMargin = round2(marginBase.sell - marginBase.cost);
  const itemMarginPct =
    marginBase.cost > 0
      ? Math.round((itemMargin / marginBase.cost) * 1000) / 10
      : null;

  return (
    <div className="space-y-6">
      <ItemSection
        title="Flights & hotels"
        items={travel}
        currency={currency}
        bookingId={bookingId}
        onRemove={remove}
        onConfirm={confirmItem}
        onSavePricing={savePricing}
        onAdd={() => openDialog(TRAVEL_ITEM_TYPES)}
        addLabel="Add flight / hotel"
        pending={pending}
        emptyText="No flights or hotels yet. Add them here or from Search."
      />

      <ItemSection
        title="Extras & fees"
        items={extras}
        currency={currency}
        bookingId={bookingId}
        onRemove={remove}
        onConfirm={confirmItem}
        onSavePricing={savePricing}
        onAdd={() => openDialog(EXTRA_ITEM_TYPES)}
        addLabel="Add extra"
        pending={pending}
        emptyText="No excursions, insurance or fees yet."
      />

      {costedItems.length > 0 && (
        <p className="text-muted-foreground text-xs tabular-nums">
          Margin (items with known cost): {formatMoney(itemMargin, currency)}
          {itemMarginPct !== null ? ` · ${itemMarginPct}%` : ""}
        </p>
      )}

      <Dialog open={dialogTypes !== null} onOpenChange={(o) => !o && setDialogTypes(null)}>
        <DialogContent className={isTravelDialog ? "sm:max-w-2xl" : undefined}>
          <DialogHeader>
            <DialogTitle>{isTravelDialog ? "Add flight / hotel" : "Add extra"}</DialogTitle>
          </DialogHeader>

          {isTravelDialog && (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={tab === "search" ? "default" : "outline"}
                onClick={() => setTab("search")}
              >
                Search
              </Button>
              <Button
                type="button"
                size="sm"
                variant={tab === "manual" ? "default" : "outline"}
                onClick={() => setTab("manual")}
              >
                Manual
              </Button>
            </div>
          )}

          {isTravelDialog && tab === "search" ? (
            <BookingSearchPanel
              bookingId={bookingId}
              currency={currency}
              onAdded={onSearchAdded}
            />
          ) : (
            <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bi-type">Type</Label>
              <Select
                id="bi-type"
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value as BookingItemType }))
                }
              >
                {(dialogTypes ?? []).map((t) => (
                  <option key={t} value={t}>
                    {BOOKING_ITEM_TYPE_META[t].label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bi-amount">Price ({currency})</Label>
              <Input
                id="bi-amount"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bi-cost">Net cost ({currency})</Label>
              <Input
                id="bi-cost"
                type="number"
                min="0"
                step="0.01"
                value={form.unitCost}
                onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))}
                placeholder="Optional"
              />
              {(() => {
                // Live derived-margin hint next to the cost input; "—" until a
                // real cost + price pair exists (never invent a margin).
                const c = form.unitCost === "" ? null : Number(form.unitCost);
                const a = form.amount === "" ? 0 : Number(form.amount);
                const m =
                  c == null || c <= 0 ? null : marginFromCostPrice(c, a);
                return (
                  <p className="text-muted-foreground text-xs tabular-nums">
                    Margin: {m === null ? "—" : `${round2(m)}%`}
                  </p>
                );
              })()}
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="bi-title">Title</Label>
              <Input
                id="bi-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={isTravelDialog ? "e.g. CDG → RAK, Royal Air Maroc" : "e.g. Desert excursion"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bi-supplier">Supplier</Label>
              <SupplierPicker
                id="bi-supplier"
                suppliers={suppliers}
                value={form.supplier}
                supplierId={form.supplierId}
                onChange={(name, id) =>
                  setForm((f) => ({ ...f, supplier: name, supplierId: id }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bi-ref">Booking ref / PNR</Label>
              <Input
                id="bi-ref"
                value={form.bookingRef}
                onChange={(e) => setForm((f) => ({ ...f, bookingRef: e.target.value }))}
              />
            </div>
            {isTravelDialog && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="bi-start">Start date</Label>
                  <Input
                    id="bi-start"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bi-end">End date</Label>
                  <Input
                    id="bi-end"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogTypes(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending || !form.title}>
              {pending ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ItemSection({
  title,
  items,
  currency,
  bookingId: _bookingId,
  onRemove,
  onConfirm,
  onSavePricing,
  onAdd,
  addLabel,
  pending,
  emptyText,
}: {
  title: string;
  items: BookingItemRow[];
  currency: string;
  bookingId: string;
  onRemove: (id: string) => void;
  onConfirm: (id: string) => void;
  onSavePricing: (
    id: string,
    pricing: { amount: number; unitCost: number | null; quantity: number }
  ) => void;
  onAdd: () => void;
  addLabel: string;
  pending: boolean;
  emptyText: string;
}) {
  const subtotal = items.reduce(
    (s, i) => s + parseFloat(i.amount || "0") * i.quantity,
    0
  );
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {items.length > 0 && (
          <span className="text-muted-foreground text-sm">
            {formatMoney(subtotal, currency)}
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-muted-foreground mb-2 text-sm">{emptyText}</p>
      ) : (
        <ul className="mb-3 space-y-3">
          {items.map((item) => {
            const canConfirm =
              item.itemStatus === "pending" &&
              !item.confirmationNumber &&
              (item.type === "flight" || item.type === "hotel");
            return (
              <li key={item.id} className="group/item relative">
                <BookingSegmentCard
                  item={{
                    id: item.id,
                    type: item.type,
                    title: item.title,
                    description: item.description,
                    supplier: item.supplier,
                    bookingRef: item.bookingRef,
                    startDate: item.startDate,
                    endDate: item.endDate,
                    quantity: item.quantity,
                    amount: item.amount,
                    currency: item.currency,
                    itemStatus: item.itemStatus,
                    confirmationNumber: item.confirmationNumber,
                    details: item.details,
                  }}
                />
                <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                  {item.confirmationNumber && (
                    <span className="text-muted-foreground mr-auto font-mono text-xs">
                      {item.confirmationNumber}
                    </span>
                  )}
                  <BookingPricingRow
                    item={item}
                    disabled={pending}
                    onSave={(pricing) => onSavePricing(item.id, pricing)}
                  />
                  {canConfirm && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onConfirm(item.id)}
                      disabled={pending}
                    >
                      Confirm
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(item.id)}
                    disabled={pending}
                    aria-label="Remove item"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Button variant="outline" size="sm" onClick={onAdd}>
        <Plus className="mr-2 size-4" />
        {addLabel}
      </Button>
    </div>
  );
}

/**
 * Compact two-way cost → margin% → price editor for one booking line.
 *
 * Mirrors the proposal builder's `PricingRow` (same pure `pricing.ts` math) but
 * is null-aware: a booking item's `unitCost` can be *unknown*. An empty cost
 * field commits `unitCost: null` (never a fabricated 0), and the derived margin
 * shows "—" until a real cost + price pair exists. Edits commit on blur, and
 * only when something actually changed, so browsing never fires writes.
 */
function BookingPricingRow({
  item,
  disabled,
  onSave,
}: {
  item: BookingItemRow;
  disabled: boolean;
  onSave: (pricing: {
    amount: number;
    unitCost: number | null;
    quantity: number;
  }) => void;
}) {
  // Draft strings. `cost` "" means unknown; `marginDraft` null means "track the
  // derived margin" (computed from the current cost/price).
  const [cost, setCost] = useState(item.unitCost ?? "");
  const [price, setPrice] = useState(item.amount);
  const [marginDraft, setMarginDraft] = useState<string | null>(null);
  // Re-seed drafts from the server whenever the persisted values change
  // (render-phase setState — the React-sanctioned reset-on-prop-change pattern).
  const [synced, setSynced] = useState({
    cost: item.unitCost ?? "",
    price: item.amount,
  });
  if (synced.cost !== (item.unitCost ?? "") || synced.price !== item.amount) {
    setCost(item.unitCost ?? "");
    setPrice(item.amount);
    setMarginDraft(null);
    setSynced({ cost: item.unitCost ?? "", price: item.amount });
  }

  // Cost unknown when the field is blank; a blank cost yields margin "—".
  const costKnown = cost.trim() !== "";
  const costNum = toNumber(cost);
  const priceNum = toNumber(price);
  const derivedMargin =
    costKnown && costNum > 0 ? marginFromCostPrice(costNum, priceNum) : null;

  const marginValue =
    marginDraft ??
    (derivedMargin === null ? "" : String(round2(derivedMargin)));

  const commit = (next: { cost: string; price: number }) => {
    const nextCost = next.cost.trim() === "" ? null : round2(toNumber(next.cost));
    const prevCost =
      synced.cost.trim() === "" ? null : round2(toNumber(synced.cost));
    // Only write when cost or price actually changed vs the last server sync.
    if (nextCost === prevCost && round2(next.price) === round2(toNumber(synced.price))) {
      return;
    }
    onSave({ amount: next.price, unitCost: nextCost, quantity: item.quantity });
  };

  const onMarginChange = (raw: string) => {
    setMarginDraft(raw);
    // Typing a margin recomputes the price live (cost unchanged). Only meaningful
    // when a real cost is present — the input is disabled otherwise.
    const m = raw === "" ? 0 : Number(raw);
    if (Number.isFinite(m)) {
      setPrice(String(priceFromMargin(costNum, m)));
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <label className="sr-only" htmlFor={`bcost-${item.id}`}>
        Net cost
      </label>
      <Input
        id={`bcost-${item.id}`}
        type="number"
        min="0"
        step="0.01"
        value={cost}
        disabled={disabled}
        placeholder="cost"
        onChange={(e) => {
          // A booking item's sell price is what the client agreed — editing the
          // recorded cost must NEVER reprice the line. The price stays put and
          // the displayed margin re-derives from (new cost, existing price).
          // Only an explicit margin edit recomputes the price.
          setCost(e.target.value);
          setMarginDraft(null);
        }}
        onBlur={() => commit({ cost, price: toNumber(price) })}
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
          disabled={disabled || !costKnown || costNum === 0}
          placeholder="—"
          onChange={(e) => onMarginChange(e.target.value)}
          onBlur={() => {
            setMarginDraft(null);
            commit({ cost, price: toNumber(price) });
          }}
          className="h-7 w-14 pr-4 text-right text-xs tabular-nums"
          aria-label="Margin percent"
        />
        <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-xs">
          %
        </span>
      </div>
      <label className="sr-only" htmlFor={`bprice-${item.id}`}>
        Sell price
      </label>
      <Input
        id={`bprice-${item.id}`}
        type="number"
        min="0"
        step="0.01"
        value={price}
        disabled={disabled}
        onChange={(e) => {
          setPrice(e.target.value);
          setMarginDraft(null); // fall back to derived margin from the new price
        }}
        onBlur={() => commit({ cost, price: toNumber(price) })}
        className="h-7 w-24 text-right text-xs font-semibold tabular-nums"
        aria-label="Sell price"
      />
    </div>
  );
}
