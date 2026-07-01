import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatStrip } from "@/components/app/stat-strip";
import { OperationsBoard } from "@/components/operations/operations-board";
import { Button } from "@/components/ui/button";
import { headlineTotal, num, sumByCurrency } from "@/lib/analytics";
import { db } from "@/lib/db";
import { DEFAULT_CURRENCY, seesAllData } from "@/lib/domain";
import { formatMoneyCompact } from "@/lib/format";
import { requireAgencyUser } from "@/lib/permissions";
import { booking } from "@/lib/schema";

export const metadata = { title: "Operations" };

const MS_PER_DAY = 86_400_000;
const UPCOMING_WINDOW_DAYS = 30;

export default async function OperationsPage() {
  const user = await requireAgencyUser();
  const t = await getTranslations("operations");
  const canSeeAll = seesAllData(user.role);

  // Agency scope ALWAYS applies; full-visibility roles see the whole agency,
  // agents see only the bookings they created within their agency.
  const bookings = await db.query.booking.findMany({
    where: canSeeAll
      ? eq(booking.agencyId, user.agencyId)
      : and(
          eq(booking.agencyId, user.agencyId),
          eq(booking.createdById, user.id)
        ),
    with: { client: { columns: { name: true } } },
    orderBy: [desc(booking.updatedAt)],
    limit: 500,
  });

  const rows = bookings.map((b) => ({
    id: b.id,
    reference: b.reference,
    status: b.status,
    destination: b.destination,
    departDate: b.departDate,
    totalAmount: b.totalAmount,
    currency: b.currency,
    clientName: b.client?.name ?? null,
  }));

  // --- KPI derivations (currency-safe) -------------------------------------
  const active = bookings.filter((b) => b.status !== "cancelled");
  const now = new Date();
  const upcomingCutoff = new Date(now.getTime() + UPCOMING_WINDOW_DAYS * MS_PER_DAY);
  const upcoming = active.filter(
    (b) =>
      b.departDate &&
      new Date(b.departDate) >= now &&
      new Date(b.departDate) <= upcomingCutoff
  );
  // Pipeline value: never sum across currencies — headline the agency default
  // (DZD) only; stray-currency bookings are excluded from the money figure.
  const pipelineValue = headlineTotal(
    sumByCurrency(
      active,
      (b) => num(b.totalAmount),
      (b) => b.currency
    )
  );

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6 px-4 py-8 sm:px-6">
      <PageHeader title={t("title")} description={t("description")} />

      {bookings.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t("noOperations")}
          description="Bookings appear here as they move through the workflow."
          action={
            <Button asChild>
              <Link href="/bookings/new">New booking</Link>
            </Button>
          }
        />
      ) : (
        <>
          <StatStrip
            items={[
              { label: "Active bookings", value: active.length },
              { label: "Total in workflow", value: bookings.length },
              { label: "Departing soon", value: upcoming.length },
              {
                label: "Pipeline value",
                value: formatMoneyCompact(pipelineValue, DEFAULT_CURRENCY),
              },
            ]}
          />

          <OperationsBoard bookings={rows} />
        </>
      )}
    </div>
  );
}
