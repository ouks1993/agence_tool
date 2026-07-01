"use client";

import { useState, useTransition } from "react";
import { Sparkles, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { buildQuote, type QuoteResult } from "@/lib/actions/ai";
import { SUPPORTED_CURRENCIES } from "@/lib/domain";

/**
 * AI quote builder. Turns a free-text brief into a structured set of proposal
 * line items, previewed in a dialog. Confirming fires `onQuote` for the parent.
 */
export function AiQuoteBuilder({
  onQuote,
  trigger,
}: {
  onQuote: (result: QuoteResult) => void;
  /** Optional custom trigger; defaults to a "Build with AI" outline button. */
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [brief, setBrief] = useState("");
  const [currency, setCurrency] = useState("DZD");
  const [paxCount, setPaxCount] = useState("2");
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setBrief("");
    setCurrency("DZD");
    setPaxCount("2");
    setResult(null);
    setError(null);
    setCopied(false);
  };

  const generate = () => {
    setError(null);
    startTransition(async () => {
      const pax = paxCount === "" ? 1 : Number(paxCount);
      const res = await buildQuote(brief, currency, pax);
      if (res.ok && res.data) {
        setResult(res.data);
      } else if (!res.ok) {
        setError(res.error);
        setResult(null);
      }
    });
  };

  const copy = () => {
    if (!result) return;
    const lines = [
      result.title,
      "",
      ...result.items.map(
        (it) =>
          `${it.type} — ${it.title} · ${it.quantity} × ${it.unitCost.toLocaleString()} ${currency}`
      ),
    ];
    navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  const use = () => {
    if (result) onQuote(result);
    setOpen(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Sparkles className="mr-2 size-4" />
            Build with AI
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Build a quote with AI</DialogTitle>
          <DialogDescription>
            AI-generated estimates. Review costs and suppliers before quoting a client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="q-brief">Describe the trip</Label>
            <Textarea
              id="q-brief"
              rows={3}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="7 nights in Bali for 2 adults, beach resort, budget €4000 including flights from Paris"
              disabled={pending}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="q-currency">Currency</Label>
              <Select
                id="q-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={pending}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-pax">Travellers</Label>
              <Input
                id="q-pax"
                type="number"
                min="1"
                value={paxCount}
                onChange={(e) => setPaxCount(e.target.value)}
                disabled={pending}
              />
            </div>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          {result && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{result.title}</p>
                <Button variant="ghost" size="sm" onClick={copy}>
                  {copied ? (
                    <Check className="mr-1 size-3.5" />
                  ) : (
                    <Copy className="mr-1 size-3.5" />
                  )}
                  {copied ? "Copied" : "Copy to clipboard"}
                </Button>
              </div>
              <ul className="divide-y">
                {result.items.map((it, idx) => (
                  <li
                    key={`${it.type}-${idx}`}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{it.title}</p>
                      <p className="text-muted-foreground text-xs capitalize">
                        {it.type}
                        {it.supplier ? ` · ${it.supplier}` : ""}
                      </p>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {it.quantity} × {it.unitCost.toLocaleString()} {currency}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground text-xs">
                Create the proposal first, then add these items.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={generate}
            disabled={pending || !brief.trim()}
          >
            {pending ? "Generating…" : result ? "Regenerate" : "Generate quote"}
          </Button>
          <Button onClick={use} disabled={!result || pending}>
            Use this quote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
