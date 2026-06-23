"use client";

import { useState, useTransition } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const drop = (dayIndex: number | null) => {
    if (!dragId) return;
    const id = dragId;
    setDragId(null);
    startTransition(async () => {
      const res = await assignItemDay(id, bookingId, dayIndex);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  };

  return (
    <div className="space-y-6">
      <ShareLink bookingId={bookingId} shareToken={shareToken} />

      <p className="text-muted-foreground text-sm">
        Drag a service onto a day to schedule it. Click a day to add a title and notes.
      </p>

      {unscheduled.length > 0 && (
        <DropZone label="Unscheduled" onDrop={() => drop(null)}>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((it) => (
              <ItemChip key={it.id} item={it} onDragStart={() => setDragId(it.id)} />
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
                  <p className="text-muted-foreground mb-2 text-sm whitespace-pre-wrap">
                    {day.notes}
                  </p>
                )}
                {day.items.length === 0 ? (
                  <p className="text-muted-foreground text-xs">Drop services here.</p>
                ) : (
                  <div className="space-y-2">
                    {day.items.map((it) => (
                      <ItemRow key={it.id} item={it} onDragStart={() => setDragId(it.id)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </DropZone>
        ))}
      </div>
    </div>
  );
}

function DropZone({
  label,
  heading,
  action,
  onDrop,
  children,
}: {
  label: string;
  heading?: string;
  action?: React.ReactNode;
  onDrop: () => void;
  children: React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
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
        "rounded-lg border p-4 transition-colors",
        over ? "border-primary bg-accent" : "bg-card"
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide uppercase">{label}</p>
          {heading && <p className="text-sm font-medium">{heading}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ItemRow({ item, onDragStart }: { item: ItemVM; onDragStart: () => void }) {
  const Icon = ICONS[item.type as BookingItemType] ?? Package;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-background flex cursor-grab items-center gap-2 rounded-md border p-2 active:cursor-grabbing"
    >
      <GripVertical className="text-muted-foreground size-4 shrink-0" />
      <Icon className="size-4 shrink-0" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="text-muted-foreground truncate text-xs">{item.meta}</p>
      </div>
    </div>
  );
}

function ItemChip({ item, onDragStart }: { item: ItemVM; onDragStart: () => void }) {
  const Icon = ICONS[item.type as BookingItemType] ?? Package;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-background flex cursor-grab items-center gap-1.5 rounded-md border px-2 py-1.5 text-sm active:cursor-grabbing"
    >
      <Icon className="size-3.5" />
      <span className="max-w-48 truncate">{item.title}</span>
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
        placeholder="Day title (e.g. Arrival & medina tour)"
      />
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="Notes for the day…"
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
    <div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-lg border p-3">
      <Link2 className="text-muted-foreground size-4" />
      {url ? (
        <>
          <code className="bg-background min-w-0 flex-1 truncate rounded px-2 py-1 text-xs">
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
