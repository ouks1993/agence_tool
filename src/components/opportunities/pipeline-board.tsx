"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical, MapPin, Calendar, Plus } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/app/status-badge";
import {
  PipelineFilterBar,
  type BoardView,
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
  OPEN_STAGES,
  OPPORTUNITY_STAGE_META,
  PRODUCT_STATUS_META,
  TRAVEL_PURPOSE_LABEL,
  type OpportunityStage,
  type ProductStatus,
  type TravelPurpose,
} from "@/lib/domain";
import { formatMoney, formatDate, initials } from "@/lib/format";
import { statusTone } from "@/lib/status-tone";
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
  proposalStatus: string | null;
};

const CLOSING_SOON_DAYS = 14;

/** Board columns: open pipeline + won. Lost is never a lane — it's surfaced via
 *  the "Lost" scope filter instead (mirrors the funnel, which drops 'lost'). */
const BOARD_STAGES: OpportunityStage[] = [...OPEN_STAGES, "won"];

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
  const [view, setView] = useState<BoardView>("board");

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

  // Lost deals get their own segment (a single "Lost" lane) rather than a
  // permanent column; every other scope shows the open+won board lanes.
  const columns = useMemo<OpportunityStage[]>(
    () => (scope === "lost" ? ["lost"] : BOARD_STAGES),
    [scope]
  );

  const byStage = useMemo(() => {
    const map: Record<string, BoardItem[]> = {};
    for (const s of columns) map[s] = [];
    for (const item of filtered) {
      map[item.stage]?.push(item);
    }
    return map;
  }, [filtered, columns]);

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
        view={view}
        onViewChange={setView}
      />

      {view === "list" ? (
        <PipelineList
          columns={columns}
          byStage={byStage}
          pending={pending}
          onMove={move}
        />
      ) : (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((stage) => {
          const meta = OPPORTUNITY_STAGE_META[stage];
          const cards = byStage[stage] ?? [];
          const total = cards.reduce((sum, c) => sum + parseFloat(c.value || "0"), 0);
          const currency = cards[0]?.currency;
          return (
            <div key={stage} className="w-[19rem] shrink-0">
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className={cn("size-2 rounded-full", dotColor(stage))} />
                <h2 className="text-sm font-semibold">{meta.label}</h2>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {cards.length}
                </span>
                <span className="ml-auto text-xs font-semibold tabular-nums">
                  {formatMoney(total, currency)}
                </span>
              </div>

              <div className="bg-muted/40 min-h-24 space-y-2 rounded-lg p-2">
                {cards.map((c) => (
                  <Card
                    key={c.id}
                    item={c}
                    stage={stage}
                    pending={pending}
                    onMove={move}
                  />
                ))}

                {/* Empty lanes stay actionable via the dashed "Add deal" CTA. */}
                <AddDealButton stage={stage} empty={cards.length === 0} />
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

/** Compact table rendering of the same filtered pipeline (list view toggle). */
function PipelineList({
  columns,
  byStage,
  pending,
  onMove,
}: {
  columns: OpportunityStage[];
  byStage: Record<string, BoardItem[]>;
  pending: boolean;
  onMove: (id: string, stage: OpportunityStage) => void;
}) {
  const rows = columns.flatMap((s) => byStage[s] ?? []);
  if (rows.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed py-12 text-center text-sm">
        No deals match these filters.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground text-xs">
          <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
            <th>Deal</th>
            <th>Stage</th>
            <th>Owner</th>
            <th className="text-right">Probability</th>
            <th className="text-right">Value</th>
            <th className="text-right">Close</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((c) => {
            const meta = OPPORTUNITY_STAGE_META[c.stage as OpportunityStage];
            return (
              <tr key={c.id} className="hover:bg-muted/30 [&>td]:px-3 [&>td]:py-2.5">
                <td className="min-w-0">
                  <Link
                    href={`/opportunities/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.title}
                  </Link>
                  {c.clientName && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      {c.clientName}
                    </span>
                  )}
                </td>
                <td>
                  <StatusBadge
                    label={meta?.label ?? c.stage}
                    variant={statusTone("opportunity", c.stage)}
                  />
                </td>
                <td className="text-muted-foreground">
                  {c.assigneeName?.split(" ")[0] ?? "—"}
                </td>
                <td className="text-right tabular-nums">{c.probability}%</td>
                <td className="text-right font-semibold tabular-nums">
                  {formatMoney(c.value, c.currency)}
                </td>
                <td className="text-muted-foreground text-right tabular-nums">
                  {c.expectedCloseDate ? formatDate(c.expectedCloseDate) : "—"}
                </td>
                <td>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="text-muted-foreground hover:text-foreground rounded p-0.5"
                      disabled={pending}
                      aria-label="Move opportunity"
                    >
                      <MoreVertical className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Move to</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {(Object.keys(OPPORTUNITY_STAGE_META) as OpportunityStage[])
                        .filter((s) => s !== c.stage)
                        .map((s) => (
                          <DropdownMenuItem key={s} onClick={() => onMove(c.id, s)}>
                            {OPPORTUNITY_STAGE_META[s].label}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AddDealButton({ stage, empty }: { stage: OpportunityStage; empty: boolean }) {
  return (
    <Link
      href={`/opportunities/new?stage=${stage}`}
      className={cn(
        "text-muted-foreground hover:border-brand hover:text-brand flex items-center justify-center gap-1.5 rounded-lg border border-dashed text-xs font-medium transition-colors",
        empty ? "py-8" : "py-2"
      )}
    >
      <Plus className="size-3.5" />
      Add deal
    </Link>
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
  const proposalMeta = c.proposalStatus
    ? PRODUCT_STATUS_META[c.proposalStatus as ProductStatus]
    : null;
  const highProb = c.probability >= 70;

  return (
    <div className="bg-card card-interactive group rounded-lg border p-3 shadow-xs">
      {/* Top: client avatar + title + reference + move menu */}
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
          <p className="text-muted-foreground mt-0.5 truncate font-mono text-[11px]">
            #{c.id.slice(0, 6).toUpperCase()}
            {c.clientName ? ` · ${c.clientName}` : ""}
          </p>
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
            {(Object.keys(OPPORTUNITY_STAGE_META) as OpportunityStage[])
              .filter((s) => s !== stage)
              .map((s) => (
                <DropdownMenuItem key={s} onClick={() => onMove(c.id, s)}>
                  {OPPORTUNITY_STAGE_META[s].label}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Chips: destination + purpose + proposal status */}
      {(c.destination || purposeLabel || proposalMeta) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
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
          {proposalMeta && (
            <StatusBadge
              label={proposalMeta.label}
              variant={statusTone("product", c.proposalStatus!)}
              className="px-2 py-0.5 text-[11px]"
            />
          )}
        </div>
      )}

      {/* Probability progress bar */}
      <div className="mt-2.5 space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground font-medium">Probability</span>
          <span
            className={cn(
              "font-semibold tabular-nums",
              highProb ? "text-success" : "text-foreground"
            )}
          >
            {c.probability}%
          </span>
        </div>
        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
          <div
            className={cn("h-full rounded-full", highProb ? "bg-success" : "bg-brand")}
            style={{ width: `${Math.min(100, Math.max(0, c.probability))}%` }}
          />
        </div>
      </div>

      {/* Footer: owner + value + close date */}
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
          <span className="text-muted-foreground">Unassigned</span>
        )}
        <span className="text-foreground text-sm font-semibold tabular-nums">
          {formatMoney(c.value, c.currency)}
        </span>
      </div>

      {c.expectedCloseDate && (
        <div className="text-muted-foreground mt-1.5 flex items-center gap-1 text-xs tabular-nums">
          <Calendar className="size-3" />
          Close {formatDate(c.expectedCloseDate)}
        </div>
      )}
    </div>
  );
}

/** Stage → column status-dot colour, aligned to the deck stage palette via
 *  chart/functional tokens (survives theming; no raw ad-hoc palette). */
function dotColor(stage: OpportunityStage): string {
  switch (stage) {
    case "lead":
      return "bg-muted-foreground/50";
    case "qualified":
      return "bg-[var(--chart-5)]"; // cyan
    case "proposal":
      return "bg-[var(--chart-4)]"; // violet
    case "booked":
      return "bg-warning"; // amber
    case "won":
      return "bg-success"; // green
    case "lost":
      return "bg-danger"; // red
    default:
      return "bg-muted-foreground/50";
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
