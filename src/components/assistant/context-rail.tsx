"use client";

import {
  ArrowRight,
  Bot,
  FileText,
  MessageSquare,
  Plane,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Right-hand context rail for the AI assistant.
 *
 * The chat surface has no server-selected client/booking, and the guardrails
 * forbid fabricating one. So the "Current client" / "Active booking" panels
 * render a tasteful generic empty state, while "Suggested actions" are real:
 * clicking one inserts a ready-made prompt into the composer (no new backend).
 */

export type SuggestedAction = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  tone: "brand" | "green" | "amber" | "violet";
  icon: "quote" | "email" | "visa" | "flight";
};

const ICONS = {
  quote: FileText,
  email: MessageSquare,
  visa: ShieldCheck,
  flight: Plane,
} as const;

// Aligned to the deck's soft-tint token family (matches marketing/mockups
// suggested-action icon chips i1–i4): brand · success · amber(warning) · violet.
const TONE_CLASSES: Record<SuggestedAction["tone"], string> = {
  brand: "bg-brand/10 text-brand",
  green: "bg-success-soft text-success",
  amber: "bg-warning-soft text-warning",
  violet: "bg-chart-4/10 text-chart-4",
};

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground mb-3 text-[11px] font-semibold uppercase tracking-[0.06em]">
      {children}
    </p>
  );
}

export function ContextRail({
  agentName,
  actions,
  onAction,
}: {
  agentName?: string | null;
  actions: SuggestedAction[];
  onAction: (prompt: string) => void;
}) {
  return (
    <aside className="bg-card border-border hidden w-[332px] shrink-0 flex-col overflow-y-auto border-l min-[1100px]:flex">
      {/* Current client — generic state (no client selected on this surface) */}
      <div className="border-border border-b p-5">
        <RailLabel>Current client</RailLabel>
        <div className="border-border bg-muted/40 flex items-start gap-3 rounded-lg border border-dashed p-4">
          <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
            <UserRound className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-foreground text-sm font-medium">
              No client in context
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs leading-5">
              Ask Atlas to look up a client and their preferences will appear
              here.
            </p>
          </div>
        </div>
      </div>

      {/* Active booking — generic state */}
      <div className="border-border border-b p-5">
        <RailLabel>Active booking</RailLabel>
        <div className="border-border bg-muted/40 rounded-lg border border-dashed p-4">
          <p className="text-foreground text-sm font-medium">
            No booking attached
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs leading-5">
            Assemble a booking file from a chat and Atlas will surface its
            progress here.
          </p>
        </div>
      </div>

      {/* Suggested actions — real: seed the composer */}
      <div className="border-border flex-1 border-b p-5">
        <RailLabel>Suggested actions</RailLabel>
        <div className="space-y-2">
          {actions.map((action) => {
            const Icon = ICONS[action.icon];
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => onAction(action.prompt)}
                className="border-border bg-card hover:border-primary hover:bg-accent focus-visible:ring-ring/50 group flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md",
                    TONE_CLASSES[action.tone]
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block text-sm font-medium">
                    {action.title}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                    {action.description}
                  </span>
                </span>
                <ArrowRight className="text-muted-foreground size-4 shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer usage note */}
      <div className="p-5">
        <div className="text-muted-foreground flex items-start gap-2 text-xs leading-5">
          <Bot className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {agentName ? `Signed in as ${agentName}. ` : ""}Grounded on your live
            CRM &amp; supplier data — always review before sending.
          </span>
        </div>
      </div>
    </aside>
  );
}
