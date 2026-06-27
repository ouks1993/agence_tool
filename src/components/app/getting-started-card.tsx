"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const DISMISSED_KEY = "atlas_getting_started_dismissed";

type Step = {
  label: string;
  description: string;
  href: string;
  done: boolean;
};

export function GettingStartedCard({ steps }: { steps: Step[] }) {
  const [dismissed, setDismissed] = useState(true); // start true to avoid flash

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
  }, []);

  const allDone = steps.every((s) => s.done);

  // Auto-dismiss once everything is complete.
  useEffect(() => {
    if (allDone) localStorage.setItem(DISMISSED_KEY, "1");
  }, [allDone]);

  if (dismissed || allDone) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Get started</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => {
              localStorage.setItem(DISMISSED_KEY, "1");
              setDismissed(true);
            }}
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">
          Complete these steps to set up your agency.
        </p>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              {step.done ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-500" />
              ) : (
                <Circle className="text-muted-foreground mt-0.5 size-5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", step.done && "text-muted-foreground line-through")}>
                  {step.done ? step.label : (
                    <Link href={step.href} className="hover:underline">
                      {step.label}
                    </Link>
                  )}
                </p>
                {!step.done && (
                  <p className="text-muted-foreground text-xs">{step.description}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
