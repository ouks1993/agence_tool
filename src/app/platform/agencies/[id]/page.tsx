import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowLeft, Eye, Mail, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { AgencyStatusControls } from "@/components/platform/agency-status-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { viewAsAgency } from "@/lib/actions/platform";
import { db } from "@/lib/db";
import { USER_ROLE_META, type UserRole } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { requirePlatformAdmin } from "@/lib/permissions";
import { agency, agencyInvite, user } from "@/lib/schema";

/** Green for active, red for suspended — matches the StatusBadge tone convention. */
function statusTone(status: string): string {
  return status === "active"
    ? "bg-green-500/15 text-green-600 dark:text-green-400"
    : "bg-red-500/15 text-red-600 dark:text-red-400";
}

export default async function AgencyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Guard: only the platform super-admin may view agency details.
  await requirePlatformAdmin();
  const { id } = await params;

  const ag = await db.query.agency.findFirst({
    where: eq(agency.id, id),
  });
  if (!ag) notFound();

  // The agency's team and its still-pending invites (scoped to this agency).
  const [members, pendingInvites] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
      })
      .from(user)
      .where(eq(user.agencyId, id))
      .orderBy(asc(user.name)),
    db
      .select({
        id: agencyInvite.id,
        email: agencyInvite.email,
        role: agencyInvite.role,
        expiresAt: agencyInvite.expiresAt,
      })
      .from(agencyInvite)
      .where(
        and(eq(agencyInvite.agencyId, id), eq(agencyInvite.status, "pending"))
      )
      .orderBy(desc(agencyInvite.createdAt)),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/platform">
          <ArrowLeft className="mr-1 size-4" />
          Agencies
        </Link>
      </Button>

      <PageHeader title={ag.name} description={ag.slug}>
        <StatusBadge
          label={ag.status === "active" ? "Active" : "Suspended"}
          tone={statusTone(ag.status)}
        />
        <form action={viewAsAgency.bind(null, ag.id)}>
          <Button type="submit" size="sm" variant="outline">
            <Eye className="mr-1 size-4" /> View agency app
          </Button>
        </form>
        <AgencyStatusControls agencyId={ag.id} status={ag.status} />
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Slug</p>
            <p className="font-medium">{ag.slug}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Status</p>
            <p className="font-medium capitalize">{ag.status}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Created</p>
            <p className="font-medium">{formatDate(ag.createdAt)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" /> Members ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <p className="text-muted-foreground px-6 py-8 text-sm">
              No members yet — the invited admin has not signed up.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Access</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id} className={m.active ? "" : "opacity-60"}>
                    <TableCell>
                      <p className="font-medium">{m.name}</p>
                      <p className="text-muted-foreground text-xs">{m.email}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={USER_ROLE_META[m.role as UserRole].label}
                        tone={USER_ROLE_META[m.role as UserRole].badgeClass}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={m.active ? "Active" : "Inactive"}
                        tone={
                          m.active
                            ? "bg-green-500/15 text-green-600 dark:text-green-400"
                            : "bg-red-500/15 text-red-600 dark:text-red-400"
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="size-4" /> Pending invites ({pendingInvites.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pendingInvites.length === 0 ? (
            <p className="text-muted-foreground px-6 py-8 text-sm">
              No pending invites.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
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
                    <TableCell className="text-muted-foreground">
                      {formatDate(inv.expiresAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
