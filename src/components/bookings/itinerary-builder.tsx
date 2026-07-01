"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plane,
  BedDouble,
  Car,
  Ticket,
  ShieldCheck,
  Receipt,
  Package,
  GripVertical,
  Pencil,
  Link2,
  Check,
  X,
  MapPinned,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  assignItemDay,
  setDayNote,
  generateShareLink,
  revokeShareLink,
} from "@/lib/actions/bookings";
import type { BookingItemType } from "@/lib/domain";
import { cn } from "@/lib/utils";

const ICONS: Record<BookingItemType, React.ComponentType<{ className?: string }>> = {
  flight: Plane,
  hotel: BedDouble,
  transfer: Car,
  excursion: Ticket,
  insurance: ShieldCheck,
  fee: Receipt,
  other: Package,
};

export type ItemVM = { id: string; type: string; title: string; meta: string };
export type DayVM = {
  dayIndex: number;
  dateLabel: string;
  title: string;
  notes: string;
  items: ItemVM[];
};

export function ItineraryBuilder({
  bookingId,
  days,
  unscheduled,
  shareToken,
}: {
  bookingId: string;
  days: DayVM[];
  unscheduled: ItemVM[];
  shareToken: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [editDay, setEditDay] = useState<number | null>(null);

  const totalItems = unscheduled.length + days.reduce((n, d) => n + d.items.length, 0);
  const hasItems = totalItems > 0;

  // Assign an item to a day (or null = unscheduled). Shared by drag-drop and the
  // touch/keyboard "Assign to day" select so both paths hit the same action.
  const assign = (itemId: string, dayIndex: number | null) => {
    startTransition(async () => {
      const res = await assignItemDay(itemId, bookingId, dayIndex);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  };

  const drop = (dayIndex: number | null) => {
    if (!dragId) return;
    const id = dragId;
    setDragId(null);
    assign(id, dayIndex);
  };

  const dayOptions = days.map((d) => ({
    value: String(d.dayIndex),
    label: `Day ${d.dayIndex + 1}${d.dateLabel ? ` · ${d.dateLabel}` : ""}`,
  }));

  return (
    <div className="space-y-6">
      <ShareLink bookingId={bookingId} shareToken={shareToken} />

      {!hasItems ? (
        <EmptyState bookingId={bookingId} />
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            Assign each service to a day using its <span className="font-medium">Assign to day</span>{" "}
            menu, or drag it onto a day. Open a day to add a title and notes.
          </p>

          {unscheduled.length > 0 && (
            <DropZone
              label="Unscheduled"
              sub={`${unscheduled.length} to schedule`}
              onDrop={() => drop(null)}
            >
              <div className="space-y-2">
                {unscheduled.map((it) => (
                  <ItemRow
                    key={it.id}
                    item={it}
                    dayOptions={dayOptions}
                    currentDay={null}
                    disabled={pending}
                    onDragStart={() => setDragId(it.id)}
                    onDragEnd={() => setDragId(null)}
                    onAssign={(day) => assign(it.id, day)}
                  />
                ))}
              </div>
            </DropZone>
          )}

          <div className="space-y-4">
            {days.map((day) => (
              <DropZone
                key={day.dayIndex}
                label={`Day ${day.dayIndex + 1}${day.dateLabel ? ` · ${day.dateLabel}` : ""}`}
                heading={day.title}
                onDrop={() => drop(day.dayIndex)}
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-expanded={editDay === day.dayIndex}
                    onClick={() => setEditDay(editDay === day.dayIndex ? null : day.dayIndex)}
                  >
                    <Pencil className="mr-1 size-3.5" />
                    {day.title || day.notes ? "Edit" : "Add notes"}
                  </Button>
                }
              >
                {editDay === day.dayIndex ? (
                  <DayEditor
                    bookingId={bookingId}
                    dayIndex={day.dayIndex}
                    initialTitle={day.title}
                    initialNotes={day.notes}
                    pending={pending}
                    onDone={() => {
                      setEditDay(null);
                      router.refresh();
                    }}
                    onCancel={() => setEditDay(null)}
                  />
                ) : (
                  <>
                    {day.notes && (
                      <p className="text-muted-foreground mb-3 text-sm whitespace-pre-wrap">
                        {day.notes}
                      </p>
                    )}
                    {day.items.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        No services yet — assign one from Unscheduled.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {day.items.map((it) => (
                          <ItemRow
                            key={it.id}
                            item={it}
                            dayOptions={dayOptions}
                            currentDay={day.dayIndex}
                            disabled={pending}
                            onDragStart={() => setDragId(it.id)}
                            onDragEnd={() => setDragId(null)}
                            onAssign={(d) => assign(it.id, d)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </DropZone>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ bookingId }: { bookingId: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center py-16 text-center">
        <MapPinned className="text-muted-foreground size-16" aria-hidden />
        <h3 className="mt-4 text-lg font-semibold">No services to schedule yet</h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          Add flights, hotels, transfers and extras to this booking, then come back to lay
          them out across the trip days.
        </p>
        <Button asChild className="mt-6">
          <Link href={`/bookings/${bookingId}`}>Add services to booking</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function DropZone({
  label,
  sub,
  heading,
  action,
  onDrop,
  children,
}: {
  label: string;
  sub?: string;
  heading?: string;
  action?: React.ReactNode;
  onDrop: () => void;
  children: React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  return (
    <Card
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onDrop();
      }}
      className={cn(
        "transition-colors",
        over && "border-primary bg-accent"
      )}
    >
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
        <div className="min-w-0">
          <CardTitle className="text-base">
            {label}
            {sub && <span className="text-muted-foreground ml-2 text-sm font-normal">{sub}</span>}
          </CardTitle>
          {heading && <p className="text-muted-foreground mt-1 text-sm">{heading}</p>}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ItemRow({
  item,
  dayOptions,
  currentDay,
  disabled,
  onDragStart,
  onDragEnd,
  onAssign,
}: {
  item: ItemVM;
  dayOptions: { value: string; label: string }[];
  currentDay: number | null;
  disabled: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onAssign: (dayIndex: number | null) => void;
}) {
  const Icon = ICONS[item.type as BookingItemType] ?? Package;
  const selectId = `assign-${item.id}`;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="bg-surface-2 flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center"
    >
      <span
        className="text-muted-foreground hidden cursor-grab shrink-0 active:cursor-grabbing sm:inline-flex"
        aria-hidden
      >
        <GripVertical className="size-4" />
      </span>
      <span className="bg-accent text-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="text-muted-foreground truncate text-xs tabular-nums">{item.meta}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <label htmlFor={selectId} className="text-muted-foreground text-xs">
          Assign to
        </label>
        <Select
          id={selectId}
          className="h-8 w-40 text-sm"
          disabled={disabled}
          value={currentDay === null ? "" : String(currentDay)}
          onChange={(e) =>
            onAssign(e.target.value === "" ? null : Number(e.target.value))
          }
          aria-label={`Assign ${item.title} to a day`}
        >
          <option value="">Unscheduled</option>
          {dayOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

function DayEditor({
  bookingId,
  dayIndex,
  initialTitle,
  initialNotes,
  pending,
  onDone,
  onCancel,
}: {
  bookingId: string;
  dayIndex: number;
  initialTitle: string;
  initialNotes: string;
  pending: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [notes, setNotes] = useState(initialNotes);
  const [saving, startSave] = useTransition();

  const save = () => {
    startSave(async () => {
      const res = await setDayNote(bookingId, dayIndex, title, notes);
      if (res.ok) {
        toast.success("Day updated");
        onDone();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Day title (e.g. Arrival & city tour)"
        aria-label={`Day ${dayIndex + 1} title`}
      />
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="Notes for the day…"
        aria-label={`Day ${dayIndex + 1} notes`}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving || pending}>
          <Check className="mr-1 size-4" />
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="mr-1 size-4" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ShareLink({
  bookingId,
  shareToken,
}: {
  bookingId: string;
  shareToken: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState(shareToken);
  const url = token ? `${typeof window !== "undefined" ? window.location.origin : ""}/i/${token}` : null;

  const create = () => {
    startTransition(async () => {
      const res = await generateShareLink(bookingId);
      if (res.ok && res.data) {
        setToken(res.data.token);
        await navigator.clipboard
          .writeText(`${window.location.origin}/i/${res.data.token}`)
          .catch(() => {});
        toast.success("Share link created & copied");
        router.refresh();
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  };

  const revoke = () => {
    startTransition(async () => {
      const res = await revokeShareLink(bookingId);
      if (res.ok) {
        setToken(null);
        toast.success("Share link disabled");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="bg-accent flex flex-wrap items-center gap-2 rounded-lg border p-3">
      <Link2 className="text-muted-foreground size-4" />
      {url ? (
        <>
          <code className="bg-card min-w-0 flex-1 truncate rounded px-2 py-1 text-xs">
            {url}
          </code>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(url).catch(() => {});
              toast.success("Copied");
            }}
          >
            Copy
          </Button>
          <Button size="sm" variant="ghost" onClick={revoke} disabled={pending}>
            Disable
          </Button>
        </>
      ) : (
        <>
          <span className="text-muted-foreground flex-1 text-sm">
            Share a read-only itinerary link with the client.
          </span>
          <Button size="sm" variant="outline" onClick={create} disabled={pending}>
            {pending ? "…" : "Create share link"}
          </Button>
        </>
      )}
    </div>
  );
}
