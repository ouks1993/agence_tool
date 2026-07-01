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
import { addBookingItem, bookItem, removeBookingItem } from "@/lib/actions/bookings";
import {
  BOOKING_ITEM_TYPE_META,
  TRAVEL_ITEM_TYPES,
  EXTRA_ITEM_TYPES,
  type BookingItemType,
} from "@/lib/domain";
import { formatMoney } from "@/lib/format";

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

  return (
    <div className="space-y-6">
      <ItemSection
        title="Flights & hotels"
        items={travel}
        currency={currency}
        bookingId={bookingId}
        onRemove={remove}
        onConfirm={confirmItem}
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
        onAdd={() => openDialog(EXTRA_ITEM_TYPES)}
        addLabel="Add extra"
        pending={pending}
        emptyText="No excursions, insurance or fees yet."
      />

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
                <div className="mt-2 flex items-center justify-end gap-2">
                  {item.confirmationNumber && (
                    <span className="text-muted-foreground mr-auto font-mono text-xs">
                      {item.confirmationNumber}
                    </span>
                  )}
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
