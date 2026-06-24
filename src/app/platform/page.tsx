import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { Building2, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { agency, booking, client, user } from "@/lib/schema";

export const metadata = { title: "Agencies" };

/** Green for active, red for suspended — matches the StatusBadge tone convention. */
function statusTone(status: string): string {
  return status === "active"
    ? "bg-green-500/15 text-green-600 dark:text-green-400"
    : "bg-red-500/15 text-red-600 dark:text-red-400";
}

export default async function PlatformDashboardPage() {
  // Counts are computed with one grouped query per table (no N+1) and mapped by id.
  const [agencies, userCounts, clientCounts, bookingCounts] = await Promise.all([
    db.select().from(agency).orderBy(desc(agency.createdAt)),
    db
      .select({ agencyId: user.agencyId, count: sql<number>`count(*)::int` })
      .from(user)
      .groupBy(user.agencyId),
    db
      .select({ agencyId: client.agencyId, count: sql<number>`count(*)::int` })
      .from(client)
      .groupBy(client.agencyId),
    db
      .select({ agencyId: booking.agencyId, count: sql<number>`count(*)::int` })
      .from(booking)
      .groupBy(booking.agencyId),
  ]);

  const userMap = new Map(userCounts.map((r) => [r.agencyId, r.count]));
  const clientMap = new Map(clientCounts.map((r) => [r.agencyId, r.count]));
  const bookingMap = new Map(bookingCounts.map((r) => [r.agencyId, r.count]));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Agencies"
        description="Provision and manage every agency on the platform."
      >
        <Button asChild>
          <Link href="/platform/agencies/new">
            <Plus className="mr-1 size-4" />
            New agency
          </Link>
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {agencies.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
              <span className="bg-muted flex size-12 items-center justify-center rounded-full">
                <Building2 className="text-muted-foreground size-6" />
              </span>
              <div className="space-y-1">
                <p className="font-medium">No agencies yet</p>
                <p className="text-muted-foreground text-sm">
                  Provision your first agency to get started.
                </p>
              </div>
              <Button asChild>
                <Link href="/platform/agencies/new">
                  <Plus className="mr-1 size-4" />
                  New agency
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Clients</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agencies.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link
                        href={`/platform/agencies/${a.id}`}
                        className="block min-w-0 hover:underline"
                      >
                        <p className="font-medium">{a.name}</p>
                        <p className="text-muted-foreground text-xs">{a.slug}</p>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={a.status === "active" ? "Active" : "Suspended"}
                        tone={statusTone(a.status)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {userMap.get(a.id) ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      {clientMap.get(a.id) ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      {bookingMap.get(a.id) ?? 0}
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
