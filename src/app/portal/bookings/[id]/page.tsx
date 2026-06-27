import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { CheckCircle2 } from "lucide-react";
import { PayNowButton } from "@/components/portal/pay-now-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import {
  BOOKING_ITEM_TYPE_META,
  BOOKING_STATUS_META,
  PAYMENT_KIND_LABEL,
  type BookingItemType,
  type BookingStatus,
  type PaymentKind,
} from "@/lib/domain";
import { formatMoney, formatDate } from "@/lib/format";
import { requirePortalSession } from "@/lib/portal-session";
import { agency, booking } from "@/lib/schema";

export default async function PortalBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { id } = await params;
  const { paid } = await searchParams;
  const session = await requirePortalSession();

  // Strict ownership check: id + clientId + agencyId must all match.
  const b = await db.query.booking.findFirst({
    where: and(
      eq(booking.id, id),
      eq(booking.clientId, session.client.id),
      eq(booking.agencyId, session.client.agencyId)
    ),
    with: {
      items: { orderBy: (items, { asc }) => [asc(items.sortOrder)] },
      payments: { orderBy: (payments, { desc }) => [desc(payments.createdAt)] },
    },
  });

  if (!b) notFound();

  // Online self-pay is only offered once the agency has finished Stripe Connect.
  const ag = await db.query.agency.findFirst({
    where: eq(agency.id, session.client.agencyId),
    columns: { stripeConnectOnboarded: true },
  });
  const canPayOnline = ag?.stripeConnectOnboarded === true;

  const statusMeta = BOOKING_STATUS_META[b.status as BookingStatus];

  // Sum only completed payments toward what's actually paid.
  const totalPaid = b.payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
  const total = parseFloat(b.totalAmount ?? "0");
  const balance = total - totalPaid;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/portal"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to my trips
          </Link>
          <h1 className="text-2xl font-bold mt-1">{b.destination ?? "Trip"}</h1>
          <p className="text-muted-foreground text-sm">{b.reference}</p>
        </div>
        {statusMeta ? (
          <Badge variant="secondary" className={statusMeta.badgeClass}>
            {statusMeta.label}
          </Badge>
        ) : (
          <Badge variant="secondary">{b.status}</Badge>
        )}
      </div>

      {paid === "1" && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="size-5 shrink-0" />
          <span>Payment received — thank you!</span>
        </div>
      )}

      {/* Itinerary items */}
      <Card>
        <CardHeader>
          <CardTitle>Itinerary</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {b.items.map((item) => {
            const typeMeta = BOOKING_ITEM_TYPE_META[item.type as BookingItemType];
            const meta: string[] = [typeMeta?.label ?? item.type];
            if (item.supplier) meta.push(item.supplier);
            if (item.startDate) meta.push(formatDate(item.startDate));
            if (item.confirmationNumber)
              meta.push(`Ref: ${item.confirmationNumber}`);
            return (
              <div key={item.id} className="py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {meta.join(" · ")}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold">
                    {formatMoney(
                      parseFloat(item.amount || "0") * item.quantity,
                      item.currency
                    )}
                  </p>
                  {item.itemStatus === "confirmed" && (
                    <span className="text-xs text-green-600 dark:text-green-400">
                      Confirmed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {b.items.length === 0 && (
            <p className="text-sm text-muted-foreground py-3">
              No itinerary items yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payment summary */}
      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Total</span>
            <span className="font-semibold">
              {formatMoney(total, b.currency)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Paid</span>
            <span className="text-green-600 dark:text-green-400 font-semibold">
              {formatMoney(totalPaid, b.currency)}
            </span>
          </div>
          {balance > 0 && (
            <div className="flex justify-between text-sm border-t pt-3">
              <span>Balance due</span>
              <span className="font-semibold">
                {formatMoney(balance, b.currency)}
              </span>
            </div>
          )}
          {b.payments.map((p) => (
            <div
              key={p.id}
              className="flex justify-between text-xs text-muted-foreground"
            >
              <span>
                {PAYMENT_KIND_LABEL[p.kind as PaymentKind] ?? p.kind} ·{" "}
                {p.method}
              </span>
              <span className="capitalize">{p.status}</span>
            </div>
          ))}
          {balance > 0 && canPayOnline && (
            <div className="border-t pt-4">
              <PayNowButton bookingId={b.id} amount={balance} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shareable itinerary link (public, read-only) */}
      {b.shareToken && (
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/i/${b.shareToken}`}
            className="underline underline-offset-2"
          >
            View shareable itinerary →
          </Link>
        </p>
      )}
    </div>
  );
}
