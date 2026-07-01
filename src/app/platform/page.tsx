import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { Building2, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { StatStrip } from "@/components/app/stat-strip";
import {
  AgenciesTable,
  type AgencyRow,
} from "@/components/platform/agencies-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import { agency, booking, client, user } from "@/lib/schema";

export const metadata = { title: "Agencies" };

// Subscription statuses that count as a live (revenue-bearing) subscription.
const ACTIVE_SUB_STATUSES = new Set(["active", "trialing"]);

export default async function PlatformDashboardPage() {
  const t = await getTranslations("platform");

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

  // Platform-wide KPIs — all counts (no cross-currency summation).
  const totalAgencies = agencies.length;
  const activeAgencies = agencies.filter((a) => a.status === "active").length;
  const activeSubs = agencies.filter(
    (a) => a.subscriptionStatus && ACTIVE_SUB_STATUSES.has(a.subscriptionStatus)
  ).length;
  const totalBookings = bookingCounts.reduce((sum, r) => sum + r.count, 0);

  const rows: AgencyRow[] = agencies.map((a) => ({
    id: a.id,
    name: a.name,
    slug: a.slug,
    status: a.status,
    subscriptionStatus: a.subscriptionStatus,
    users: userMap.get(a.id) ?? 0,
    clients: clientMap.get(a.id) ?? 0,
    bookings: bookingMap.get(a.id) ?? 0,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={t("agencies.title")}
        description={t("agencies.description")}
      >
        {totalAgencies > 0 && (
          <Button asChild>
            <Link href="/platform/agencies/new">
              <Plus className="mr-1 size-4" />
              {t("agencies.newAgency")}
            </Link>
          </Button>
        )}
      </PageHeader>

      {totalAgencies === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-4 py-16 text-center">
            <span className="bg-muted flex size-12 items-center justify-center rounded-full">
              <Building2 className="text-muted-foreground size-6" />
            </span>
            <div className="space-y-1">
              <p className="font-medium">{t("agencies.empty")}</p>
              <p className="text-muted-foreground text-sm">
                {t("agencies.emptyDesc")}
              </p>
            </div>
            <Button asChild>
              <Link href="/platform/agencies/new">
                <Plus className="mr-1 size-4" />
                {t("agencies.newAgency")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI strip — platform-wide counts (currency-safe). */}
          <StatStrip
            items={[
              { label: t("kpi.totalAgencies"), value: totalAgencies },
              { label: t("kpi.active"), value: activeAgencies },
              { label: t("kpi.activeSubs"), value: activeSubs },
              { label: t("kpi.bookings"), value: totalBookings },
            ]}
          />

          <AgenciesTable agencies={rows} />
        </>
      )}
    </div>
  );
}
