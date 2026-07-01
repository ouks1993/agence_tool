import Link from "next/link";
import { Sparkles, Wallet, CheckCircle2, Plane, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Actionable "Atlas suggests" panel. Every suggestion is DERIVED on the server
 * from a real record (a booking with an outstanding balance, an opportunity
 * closing soon, a passport that needs re-checking) — there are no fabricated
 * suggestions. Each row links straight to the underlying record so the agent
 * can act in one hop (conversion-driving surface from the marketing deck).
 */
export type SuggestTone = "brand" | "success" | "warning";

export type Suggestion = {
  id: string;
  /** Which derived signal produced this — drives the icon + tint. */
  kind: "balance" | "proposal" | "passport";
  title: string;
  description: string;
  /** Primary CTA — deep-links to the real record. */
  actionLabel: string;
  actionHref: string;
};

const ICONS: Record<Suggestion["kind"], LucideIcon> = {
  balance: Wallet,
  proposal: CheckCircle2,
  passport: Plane,
};

// Soft-tinted icon chip per signal, using Wave-1 tokens.
const CHIP: Record<Suggestion["kind"], string> = {
  balance: "bg-primary/10 text-primary",
  proposal: "bg-success-soft text-success",
  passport: "bg-warning-soft text-warning",
};

export function AtlasSuggests({ suggestions }: { suggestions: Suggestion[] }) {
  return (
    <Card className="card-elevated border-primary/25 overflow-hidden">
      <div className="border-primary/20 flex items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
            <Sparkles className="size-4" />
          </span>
          <p className="text-sm font-semibold tracking-tight">Atlas suggests</p>
        </div>
        <Badge variant="info">
          {suggestions.length} action{suggestions.length === 1 ? "" : "s"}
        </Badge>
      </div>
      <CardContent className="space-y-4 p-5">
        {suggestions.map((s) => {
          const Icon = ICONS[s.kind];
          return (
            <div key={s.id} className="flex gap-3">
              <span
                className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ${CHIP[s.kind]}`}
                aria-hidden
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-sm leading-snug font-semibold">{s.title}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {s.description}
                </p>
                <div className="flex items-center gap-2 pt-0.5">
                  <Button asChild size="sm">
                    <Link href={s.actionHref}>{s.actionLabel}</Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={s.actionHref}>Open record</Link>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
