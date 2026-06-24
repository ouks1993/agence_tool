import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { DocShell } from "@/components/documents/doc-shell";
import { db } from "@/lib/db";
import { BOOKING_ITEM_TYPE_META, type BookingItemType } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { requireAgencyUser } from "@/lib/permissions";
import { booking } from "@/lib/schema";

export const metadata = { title: "Voucher" };

export default async function VoucherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAgencyUser();
  const { id } = await params;

  const b = await db.query.booking.findFirst({
    where: and(eq(booking.id, id), eq(booking.agencyId, user.agencyId)),
    with: {
      client: { columns: { name: true } },
      travellers: { orderBy: (t) => [asc(t.sortOrder)] },
      items: { orderBy: (t) => [asc(t.sortOrder)] },
    },
  });
  if (!b) notFound();

  return (
    <DocShell docType="Voucher" reference={b.reference} date={b.createdAt}>
      <div className="grid grid-cols-2 gap-6 py-6 text-sm">
        <div>
          <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase">Lead client</p>
          <p className="font-medium">{b.client?.name ?? "—"}</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase">Trip</p>
          <p className="font-medium">{b.destination ?? "—"}</p>
          {(b.departDate || b.returnDate) && (
            <p className="text-muted-foreground">
              {formatDate(b.departDate)} → {formatDate(b.returnDate)}
            </p>
          )}
        </div>
      </div>

      {b.travellers.length > 0 && (
        <div className="border-t py-4">
          <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase">Travellers</p>
          <ul className="grid grid-cols-2 gap-1 text-sm">
            {b.travellers.map((t) => (
              <li key={t.id}>
                {t.fullName}
                {t.passportNumber ? (
                  <span className="text-muted-foreground"> · {t.passportNumber}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t py-4">
        <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase">
          Confirmed services
        </p>
        {b.items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No services on this booking.</p>
        ) : (
          <ul className="space-y-3">
            {b.items.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{i.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {BOOKING_ITEM_TYPE_META[i.type as BookingItemType]?.label ?? i.type}
                    {i.supplier ? ` · ${i.supplier}` : ""}
                    {i.startDate ? ` · ${formatDate(i.startDate)}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-xs">Confirmation</p>
                  <p className="font-mono text-sm font-medium">
                    {i.confirmationNumber ?? i.bookingRef ?? "—"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-muted-foreground mt-6 border-t pt-4 text-xs">
        Present this voucher at check-in. All services are confirmed under the references shown
        above. Contact the agency for any changes.
      </p>
    </DocShell>
  );
}
