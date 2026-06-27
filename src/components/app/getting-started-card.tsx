"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dismissOnboarding } from "@/lib/actions/onboarding";
import { cn } from "@/lib/utils";

type Step = {
  label: string;
  description: string;
  href: string;
  done: boolean;
};

export function GettingStartedCard({
  steps,
  initialDismissed,
}: {
  steps: Step[];
  /** True when the agency has already dismissed this in the DB. */
  initialDismissed: boolean;
}) {
  const [dismissed, setDismissed] = useState(initialDismissed);
  const [pending, startTransition] = useTransition();
  const allDone = steps.every((s) => s.done);

  if (dismissed || allDone) return null;

  const dismiss = () => {
    setDismissed(true);
    startTransition(async () => {
      await dismissOnboarding();
    });
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Get started</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={dismiss}
            disabled={pending}
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
