import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <Card className={cn("card-interactive", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm font-medium">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
          </div>
          {Icon && (
            <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
              <Icon className="size-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
