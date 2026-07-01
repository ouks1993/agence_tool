"use client";

import { useState, useTransition } from "react";
import { Globe, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { checkVisa, type VisaResult } from "@/lib/actions/ai";

/**
 * AI visa-requirements helper. Looks up per-nationality visa guidance for the
 * booking's destination. Results are advisory only and must be verified.
 */
export function VisaAssistant({ bookingId }: { bookingId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<VisaResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = () => {
    setError(null);
    startTransition(async () => {
      const res = await checkVisa(bookingId);
      if (res.ok && res.data) {
        setResult(res.data);
      } else if (!res.ok) {
        setError(res.error);
        setResult(null);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="size-4" /> Visa requirements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {error && <p className="text-destructive">{error}</p>}

        {result && (
          <div className="space-y-3">
            <ul className="space-y-3">
              {result.requirements.map((r) => (
                <li key={r.nationality} className="space-y-0.5">
                  <p className="font-semibold">{r.nationality}</p>
                  <p className="text-muted-foreground">{r.summary}</p>
                </li>
              ))}
            </ul>
            <p className="rounded-md border border-warning/30 bg-warning-soft p-2 text-xs text-warning">
              {result.disclaimer}
            </p>
          </div>
        )}

        {!result && !error && (
          <p className="text-muted-foreground">
            Check AI-assisted visa guidance for your travellers&apos; nationalities.
          </p>
        )}

        {result ? (
          <Button variant="outline" size="sm" onClick={check} disabled={pending}>
            <RefreshCw className="mr-2 size-4" />
            {pending ? "Checking…" : "Refresh"}
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={check} disabled={pending}>
            <Sparkles className="mr-2 size-4" />
            {pending ? "Checking…" : "Check visa requirements"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
