"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical, MapPin, User } from "lucide-react";
import { toast } from "sonner";
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
  type OpportunityStage,
} from "@/lib/domain";
import { formatMoney, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type BoardItem = {
  id: string;
  title: string;
  clientName: string | null;
  value: string;
  currency: string;
  stage: string;
  assigneeName: string | null;
  destination: string | null;
  travelStartDate: Date | string | null;
};

export function PipelineBoard({ items }: { items: BoardItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const byStage = useMemo(() => {
    const map: Record<string, BoardItem[]> = {};
    for (const s of OPPORTUNITY_STAGES) map[s] = [];
    for (const item of items) {
      (map[item.stage] ??= []).push(item);
    }
    return map;
  }, [items]);

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
    <div className="flex gap-4 overflow-x-auto pb-4">
      {OPPORTUNITY_STAGES.map((stage) => {
        const meta = OPPORTUNITY_STAGE_META[stage];
        const cards = byStage[stage] ?? [];
        const total = cards.reduce((sum, c) => sum + parseFloat(c.value || "0"), 0);
        return (
          <div key={stage} className="w-72 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", dotColor(stage))} />
                <h2 className="text-sm font-semibold">{meta.label}</h2>
                <span className="text-muted-foreground text-xs">{cards.length}</span>
              </div>
              {total > 0 && (
                <span className="text-muted-foreground text-xs">
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
                <div
                  key={c.id}
                  className="bg-card group rounded-md border p-3 shadow-xs transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/opportunities/${c.id}`}
                      className="min-w-0 flex-1 text-sm font-medium hover:underline"
                    >
                      {c.title}
                    </Link>
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
                          <DropdownMenuItem key={s} onClick={() => move(c.id, s)}>
                            {OPPORTUNITY_STAGE_META[s].label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {c.clientName && (
                    <p className="text-muted-foreground mt-1 truncate text-xs">
                      {c.clientName}
                    </p>
                  )}

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      {formatMoney(c.value, c.currency)}
                    </span>
                    {c.assigneeName && (
                      <span className="text-muted-foreground flex items-center gap-1 text-xs">
                        <User className="size-3" />
                        {c.assigneeName.split(" ")[0]}
                      </span>
                    )}
                  </div>

                  {(c.destination || c.travelStartDate) && (
                    <div className="text-muted-foreground mt-2 flex items-center gap-1 border-t pt-2 text-xs">
                      <MapPin className="size-3" />
                      {c.destination || "—"}
                      {c.travelStartDate && (
                        <span className="ml-auto">{formatDate(c.travelStartDate)}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
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
