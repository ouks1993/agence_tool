import { and, asc, desc, eq, sql } from "drizzle-orm";
import { ShieldCheck, Activity, Info, MailPlus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { PendingInviteRow, TeamInviteForm } from "@/components/team/invite-form";
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
import { OPEN_STAGES, USER_ROLES, USER_ROLE_META } from "@/lib/domain";
import type { UserRole } from "@/lib/domain";
import { formatMoney, formatRelative, initials } from "@/lib/format";
import { requireAgencyUser, requireManager } from "@/lib/permissions";
import {
  agencyInvite,
  user,
  opportunity,
  client,
  activityLog,
} from "@/lib/schema";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  // requireManager enforces the team-management role; requireAgencyUser gives us
  // a guaranteed non-null agencyId (and redirects platform/agency-less users).
  const me = await requireManager();
  const agencyUser = await requireAgencyUser();
  const agencyId = agencyUser.agencyId;

  // Non-admins can assign every role except admin (prevents privilege escalation).
  const assignableRoles =
    me.role === "admin"
      ? [...USER_ROLES]
      : USER_ROLES.filter((r) => r !== "admin");

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
    .where(eq(user.agencyId, agencyId))
    .orderBy(asc(user.name));

  // Pending invites for this agency (the new invitation-based onboarding flow).
  const pendingInvites = await db
    .select({
      id: agencyInvite.id,
      email: agencyInvite.email,
      role: agencyInvite.role,
      token: agencyInvite.token,
      createdAt: agencyInvite.createdAt,
    })
    .from(agencyInvite)
    .where(
      and(
        eq(agencyInvite.agencyId, agencyId),
        eq(agencyInvite.status, "pending")
      )
    )
    .orderBy(desc(agencyInvite.createdAt));

  // Per-agent aggregates (agency-scoped).
  const opps = await db
    .select({
      assignedToId: opportunity.assignedToId,
      stage: opportunity.stage,
      value: opportunity.value,
    })
    .from(opportunity)
    .where(eq(opportunity.agencyId, agencyId));

  const clientCounts = await db
    .select({ ownerId: client.ownerId, count: sql<number>`count(*)::int` })
    .from(client)
    .where(eq(client.agencyId, agencyId))
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
    where: eq(activityLog.agencyId, agencyId),
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
          Onboarding is invitation-based. Invite a teammate by email below, then
          share the invite link — they set up their own account and join with the
          role you choose.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MailPlus className="size-4" /> Invite a team member
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <TeamInviteForm assignableRoles={assignableRoles} />

          {pendingInvites.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-2 text-sm font-medium">
                Pending invites ({pendingInvites.length})
              </p>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvites.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.email}</TableCell>
                        <TableCell>
                          <StatusBadge
                            label={USER_ROLE_META[inv.role as UserRole].label}
                            tone={USER_ROLE_META[inv.role as UserRole].badgeClass}
                          />
                        </TableCell>
                        <TableCell>
                          <PendingInviteRow
                            inviteId={inv.id}
                            token={inv.token}
                            email={inv.email}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
                        <div className="mt-1">
                          <StatusBadge
                            label={USER_ROLE_META[m.role as UserRole].label}
                            tone={USER_ROLE_META[m.role as UserRole].badgeClass}
                          />
                        </div>
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
                      assignableRoles={assignableRoles}
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
