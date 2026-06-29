"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical, MapPin, Calendar } from "lucide-react";
import { toast } from "sonner";
import {
  PipelineFilterBar,
  type DealScope,
  type OwnerOption,
} from "@/components/opportunities/pipeline-filter-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { changeStage } from "@/lib/actions/opportunities";
import {
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_META,
  TRAVEL_PURPOSE_LABEL,
  type OpportunityStage,
  type TravelPurpose,
} from "@/lib/domain";
import { formatMoney, formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export type { OwnerOption };

export type BoardItem = {
  id: string;
  title: string;
  clientName: string | null;
  value: string;
  currency: string;
  stage: string;
  assigneeId: string | null;
  assigneeName: string | null;
  destination: string | null;
  travelStartDate: Date | string | null;
  probability: number;
  travelPurpose: string | null;
  expectedCloseDate: Date | string | null;
};

const CLOSING_SOON_DAYS = 14;

export function PipelineBoard({
  items,
  owners,
  currentUserId,
  nowMs,
}: {
  items: BoardItem[];
  owners: OwnerOption[];
  currentUserId: string;
  /** Reference "now" captured on the server at request time — kept out of
   *  render so the client filter stays pure (no Date.now() during render). */
  nowMs: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [scope, setScope] = useState<DealScope>("all");
  const [ownerId, setOwnerId] = useState<string>("all");
  const [destination, setDestination] = useState<string>("all");

  // Distinct destinations from the already-loaded items (real data only).
  const destinations = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) if (i.destination) set.add(i.destination);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Client-side filtering over the in-memory items — no server round-trip.
  const filtered = useMemo(() => {
    const soon = nowMs + CLOSING_SOON_DAYS * 24 * 60 * 60 * 1000;
    return items.filter((i) => {
      if (scope === "mine" && i.assigneeId !== currentUserId) return false;
      if (scope === "closing") {
        if (!i.expectedCloseDate) return false;
        const t = new Date(i.expectedCloseDate).getTime();
        if (Number.isNaN(t) || t < nowMs || t > soon) return false;
      }
      if (ownerId !== "all" && i.assigneeId !== ownerId) return false;
      if (destination !== "all" && i.destination !== destination) return false;
      return true;
    });
  }, [items, scope, ownerId, destination, currentUserId, nowMs]);

  const byStage = useMemo(() => {
    const map: Record<string, BoardItem[]> = {};
    for (const s of OPPORTUNITY_STAGES) map[s] = [];
    for (const item of filtered) {
      (map[item.stage] ??= []).push(item);
    }
    return map;
  }, [filtered]);

  const move = (id: string, stage: OpportunityStage) => {
    startTransition(async () => {
      const res = await changeStage(id, stage);
      if (res.ok) {
        toast.success(`Moved to ${OPPORTUNITY_STAGE_META[stage].label}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      <PipelineFilterBar
        scope={scope}
        onScopeChange={setScope}
        owners={owners}
        ownerId={ownerId}
        onOwnerChange={setOwnerId}
        destinations={destinations}
        destination={destination}
        onDestinationChange={setDestination}
      />

      <div className="flex gap-4 overflow-x-auto pb-4">
        {OPPORTUNITY_STAGES.map((stage) => {
          const meta = OPPORTUNITY_STAGE_META[stage];
          const cards = byStage[stage] ?? [];
          const total = cards.reduce((sum, c) => sum + parseFloat(c.value || "0"), 0);
          return (
            <div key={stage} className="w-[19rem] shrink-0">
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className={cn("size-2 rounded-full", dotColor(stage))} />
                <h2 className="text-sm font-semibold">{meta.label}</h2>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {cards.length}
                </span>
                {total > 0 && (
                  <span className="ml-auto text-xs font-semibold tabular-nums">
                    {formatMoney(total, cards[0]?.currency)}
                  </span>
                )}
              </div>

              <div className="bg-muted/40 min-h-24 space-y-2 rounded-lg p-2">
                {cards.length === 0 && (
                  <p className="text-muted-foreground px-2 py-6 text-center text-xs">
                    Empty
                  </p>
                )}
                {cards.map((c) => (
                  <Card
                    key={c.id}
                    item={c}
                    stage={stage}
                    pending={pending}
                    onMove={move}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Card({
  item: c,
  stage,
  pending,
  onMove,
}: {
  item: BoardItem;
  stage: OpportunityStage;
  pending: boolean;
  onMove: (id: string, stage: OpportunityStage) => void;
}) {
  const purposeLabel =
    c.travelPurpose && c.travelPurpose in TRAVEL_PURPOSE_LABEL
      ? TRAVEL_PURPOSE_LABEL[c.travelPurpose as TravelPurpose]
      : null;

  return (
    <div className="bg-card card-interactive group rounded-lg border p-3 shadow-xs">
      {/* Top: client avatar + title + move menu */}
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
            avatarColor(c.clientName ?? c.title)
          )}
          aria-hidden
        >
          {initials(c.clientName ?? c.title)}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/opportunities/${c.id}`}
            className="block truncate text-sm font-medium hover:underline"
          >
            {c.title}
          </Link>
          {c.clientName && (
            <p className="text-muted-foreground mt-0.5 truncate text-xs">{c.clientName}</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="text-muted-foreground hover:text-foreground -mr-1 rounded p-0.5"
            disabled={pending}
            aria-label="Move opportunity"
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {OPPORTUNITY_STAGES.filter((s) => s !== stage).map((s) => (
              <DropdownMenuItem key={s} onClick={() => onMove(c.id, s)}>
                {OPPORTUNITY_STAGE_META[s].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Chips: destination + category */}
      {(c.destination || purposeLabel) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {c.destination && (
            <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
              <MapPin className="size-3" />
              {c.destination}
            </span>
          )}
          {purposeLabel && (
            <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium">
              {purposeLabel}
            </span>
          )}
        </div>
      )}

      {/* Probability + value */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="bg-brand/10 text-brand inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums">
          {c.probability}%
        </span>
        <span className="text-sm font-semibold tabular-nums">
          {formatMoney(c.value, c.currency)}
        </span>
      </div>

      {/* Footer: owner + close date */}
      {(c.assigneeName || c.expectedCloseDate) && (
        <div className="text-muted-foreground mt-2.5 flex items-center justify-between gap-2 border-t pt-2.5 text-xs">
          {c.assigneeName ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold",
                  avatarColor(c.assigneeName)
                )}
                aria-hidden
              >
                {initials(c.assigneeName)}
              </span>
              <span className="truncate">{c.assigneeName.split(" ")[0]}</span>
            </span>
          ) : (
            <span />
          )}
          {c.expectedCloseDate && (
            <span className="flex items-center gap-1 whitespace-nowrap tabular-nums">
              <Calendar className="size-3" />
              Close {formatDate(c.expectedCloseDate)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function dotColor(stage: OpportunityStage): string {
  switch (stage) {
    case "lead":
      return "bg-slate-400";
    case "qualified":
      return "bg-blue-500";
    case "proposal":
      return "bg-amber-500";
    case "booked":
      return "bg-violet-500";
    case "won":
      return "bg-green-500";
    case "lost":
      return "bg-red-500";
    default:
      return "bg-slate-400";
  }
}

/** Deterministic soft avatar colour derived from a name string. */
function avatarColor(seed: string): string {
  const palette = [
    "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    "bg-teal-500/15 text-teal-600 dark:text-teal-400",
    "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return (
    palette[Math.abs(hash) % palette.length] ??
    "bg-blue-500/15 text-blue-600 dark:text-blue-400"
  );
}
