import { asc, desc, sql } from "drizzle-orm";
import { ShieldCheck, Activity, Info } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { MemberControls } from "@/components/team/member-controls";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { describeActivity } from "@/lib/activity-format";
import { db } from "@/lib/db";
import { OPEN_STAGES } from "@/lib/domain";
import { formatMoney, formatRelative, initials } from "@/lib/format";
import { requireManager } from "@/lib/permissions";
import { user, opportunity, client, activityLog } from "@/lib/schema";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const me = await requireManager();

  const members = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      image: user.image,
    })
    .from(user)
    .orderBy(asc(user.name));

  // Per-agent aggregates.
  const opps = await db
    .select({
      assignedToId: opportunity.assignedToId,
      stage: opportunity.stage,
      value: opportunity.value,
    })
    .from(opportunity);

  const clientCounts = await db
    .select({ ownerId: client.ownerId, count: sql<number>`count(*)::int` })
    .from(client)
    .groupBy(client.ownerId);
  const clientMap = new Map(clientCounts.map((c) => [c.ownerId, c.count]));

  const openByUser = new Map<string, number>();
  const wonByUser = new Map<string, number>();
  for (const o of opps) {
    if (!o.assignedToId) continue;
    if (OPEN_STAGES.includes(o.stage as (typeof OPEN_STAGES)[number])) {
      openByUser.set(o.assignedToId, (openByUser.get(o.assignedToId) ?? 0) + 1);
    }
    if (o.stage === "won") {
      wonByUser.set(
        o.assignedToId,
        (wonByUser.get(o.assignedToId) ?? 0) + parseFloat(o.value || "0")
      );
    }
  }

  const activities = await db.query.activityLog.findMany({
    with: { user: { columns: { name: true } } },
    orderBy: [desc(activityLog.createdAt)],
    limit: 30,
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Team"
        description="Manage access and oversee what your team is working on."
      />

      <div className="bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-lg border p-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          New team members create their own account at{" "}
          <span className="font-medium">/register</span>. They join as agents — set
          their role and access here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" /> Members ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="text-right">Clients</TableHead>
                <TableHead className="text-right">Open opps</TableHead>
                <TableHead className="text-right">Won</TableHead>
                <TableHead className="text-right">Access</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id} className={m.active ? "" : "opacity-60"}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs">
                          {initials(m.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-medium">
                          {m.name}
                          {m.id === me.id && (
                            <span className="text-muted-foreground text-xs">
                              (you)
                            </span>
                          )}
                          {!m.active && (
                            <StatusBadge
                              label="Inactive"
                              tone="bg-red-500/15 text-red-600 dark:text-red-400"
                            />
                          )}
                        </p>
                        <p className="text-muted-foreground text-xs">{m.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {clientMap.get(m.id) ?? 0}
                  </TableCell>
                  <TableCell className="text-right">
                    {openByUser.get(m.id) ?? 0}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(wonByUser.get(m.id) ?? 0)}
                  </TableCell>
                  <TableCell>
                    <MemberControls
                      userId={m.id}
                      role={m.role}
                      active={m.active}
                      isSelf={m.id === me.id}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4" /> Team activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {activities.map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <Avatar className="mt-0.5 size-7">
                    <AvatarFallback className="text-xs">
                      {initials(a.user?.name ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{a.user?.name ?? "Someone"}</span>{" "}
                      {describeActivity(a)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatRelative(a.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
