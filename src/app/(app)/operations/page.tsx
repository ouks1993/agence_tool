import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { BookingsBoard } from "@/components/bookings/bookings-board";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { seesAllData } from "@/lib/domain";
import { requireAgencyUser } from "@/lib/permissions";
import { booking } from "@/lib/schema";

export const metadata = { title: "Operations" };

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
        <BookingsBoard
          bookings={bookings.map((b) => ({
            id: b.id,
            reference: b.reference,
            status: b.status,
            destination: b.destination,
            departDate: b.departDate,
            totalAmount: b.totalAmount,
            currency: b.currency,
            clientName: b.client?.name ?? null,
          }))}
        />
      )}
    </div>
  );
}
