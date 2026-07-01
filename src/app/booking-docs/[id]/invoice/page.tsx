import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { FileWarning } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { DocShell } from "@/components/documents/doc-shell";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { PAYMENT_KIND_LABEL } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { paymentSummary } from "@/lib/payments/summary";
import { requireAgencyUser } from "@/lib/permissions";
import { booking } from "@/lib/schema";

export const metadata = { title: "Invoice" };

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAgencyUser();
  const { id } = await params;

  const b = await db.query.booking.findFirst({
    where: and(eq(booking.id, id), eq(booking.agencyId, user.agencyId)),
    with: {
      client: { columns: { name: true, email: true, address: true, city: true, country: true } },
      items: { orderBy: (t) => [asc(t.sortOrder)] },
      payments: { orderBy: (t) => [desc(t.createdAt)] },
    },
  });
  if (!b) notFound();

  // Hard prerequisite: a document is meaningless without trip services.
  if (b.items.length === 0) {
    return (
      <div className="doc-print-hidden mx-auto max-w-lg px-4 py-16">
        <EmptyState
          icon={FileWarning}
          title="No trip services yet"
          description="This booking has no trip services, so an invoice can't be generated. Add services to the booking first."
          action={
            <Button asChild>
              <Link href={`/bookings/${b.id}`}>Back to booking</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const total = parseFloat(b.totalAmount || "0");
  const { paid, balance } = paymentSummary(b.payments, total);

  return (
    <DocShell docType="Invoice" reference={b.reference} date={b.createdAt}>
      <div className="grid grid-cols-2 gap-6 py-6 text-sm">
        <div>
          <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase">Billed to</p>
          <p className="font-medium">{b.client?.name ?? "—"}</p>
          {b.client?.email && <p className="text-muted-foreground">{b.client.email}</p>}
          {(b.client?.address || b.client?.city) && (
            <p className="text-muted-foreground">
              {[b.client.address, b.client.city, b.client.country].filter(Boolean).join(", ")}
            </p>
          )}
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

      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40 text-foreground/70 text-left text-xs">
            <th className="rounded-l-md px-3 py-2.5 font-semibold">Description</th>
            <th className="px-3 py-2.5 text-center font-semibold">Qty</th>
            <th className="rounded-r-md px-3 py-2.5 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {b.items.map((i) => (
            <tr key={i.id} className="border-b">
              <td className="px-3 py-2.5">
                {i.title}
                {i.supplier ? (
                  <span className="text-muted-foreground"> · {i.supplier}</span>
                ) : null}
              </td>
              <td className="tabular-nums px-3 py-2.5 text-center">{i.quantity}</td>
              <td className="tabular-nums px-3 py-2.5 text-right">
                {formatMoney(parseFloat(i.amount || "0") * i.quantity, i.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="doc-avoid-break mt-6 ml-auto w-full max-w-xs space-y-1.5 text-sm">
        <Row label="Total" value={formatMoney(total, b.currency)} bold />
        <Row label="Paid" value={`− ${formatMoney(paid, b.currency)}`} />
        {balance > 0 ? (
          <div className="mt-1 flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-base font-bold text-amber-600 dark:text-amber-400">
            <span>Balance due</span>
            <span className="tabular-nums">{formatMoney(balance, b.currency)}</span>
          </div>
        ) : (
          <div className="mt-1 flex items-center justify-between rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-base font-bold text-green-600 dark:text-green-400">
            <span>Paid in full</span>
            <span className="tabular-nums">{formatMoney(0, b.currency)}</span>
          </div>
        )}
      </div>

      {b.payments.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
            Payments received
          </p>
          <ul className="space-y-1 text-sm">
            {b.payments.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span className="text-muted-foreground">
                  {formatDate(p.createdAt)} ·{" "}
                  {PAYMENT_KIND_LABEL[p.kind as keyof typeof PAYMENT_KIND_LABEL] ?? p.kind} (
                  {p.method})
                </span>
                <span className="tabular-nums">
                  {p.kind === "refund" ? "− " : ""}
                  {formatMoney(p.amount, p.currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-muted-foreground mt-8 border-t pt-4 text-xs">
        Thank you for booking with us. Please settle the balance due before the travel date.
      </p>
    </DocShell>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={bold ? "tabular-nums font-semibold" : "tabular-nums"}>{value}</span>
    </div>
  );
}
