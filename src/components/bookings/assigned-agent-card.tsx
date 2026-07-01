import { UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, initials } from "@/lib/format";

/**
 * Right-rail "Assigned agent" panel (deck: Assigned agent).
 *
 * Backed entirely by real columns: the booking's createdBy user (name / email /
 * image) plus createdAt / updatedAt timestamps. When there is no createdBy user
 * (nullable FK), the identity block is omitted and only the dates are shown.
 */
export function AssignedAgentCard({
  agent,
  createdAt,
  updatedAt,
}: {
  agent: { name: string; email: string; image: string | null } | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}) {
  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRound className="size-4" /> Assigned agent
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {agent && (
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              {agent.image && <AvatarImage src={agent.image} alt={agent.name} />}
              <AvatarFallback>{initials(agent.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium">{agent.name}</p>
              <p className="text-muted-foreground truncate text-xs">
                {agent.email}
              </p>
            </div>
          </div>
        )}
        <dl className="divide-y">
          <Row label="Created" value={formatDate(createdAt)} />
          <Row label="Last updated" value={formatDate(updatedAt)} />
        </dl>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums font-medium">{value}</dd>
    </div>
  );
}
