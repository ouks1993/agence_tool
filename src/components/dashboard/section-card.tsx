import type { ReactNode } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Dashboard card shell matching the marketing mockup: a header row with a
 * title + muted subtitle on the left and an optional action (a "view all"
 * link or a slot) on the right, over a hairline-bordered, softly elevated
 * body. Keeps every dashboard panel visually consistent.
 */
export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  action,
  actionHref,
  actionLabel,
  bodyClassName,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Custom right-aligned header content (overrides actionHref/actionLabel). */
  action?: ReactNode;
  actionHref?: string;
  actionLabel?: string;
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("card-elevated overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          {Icon && (
            <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-md">
              <Icon className="size-4" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">{title}</p>
            {subtitle && (
              <p className="text-muted-foreground truncate text-xs">{subtitle}</p>
            )}
          </div>
        </div>
        {action ??
          (actionHref && actionLabel ? (
            <Link
              href={actionHref}
              className="text-brand shrink-0 text-sm font-medium hover:underline"
            >
              {actionLabel}
            </Link>
          ) : null)}
      </div>
      <CardContent className={cn("p-5", bodyClassName)}>{children}</CardContent>
    </Card>
  );
}
