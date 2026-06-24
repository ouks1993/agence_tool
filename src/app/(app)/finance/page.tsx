import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import {
  Wallet,
  CircleDollarSign,
  TrendingUp,
  AlertTriangle,
  Receipt,
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import {
  canViewFinance,
  roleHome,
  PAYMENT_KIND_LABEL,
  type PaymentKind,
} from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { paymentSummary } from "@/lib/payments/summary";
import { requireAgencyUser } from "@/lib/permissions";
import { booking, opportunity, payment, product } from "@/lib/schema";

export const metadata = { title: "Finance" };

export default async function FinancePage() {
  const user = await requireAgencyUser();

  // Access gate: the Finance workspace is for finance, admin and manager roles.
  // Anyone else is sent to their own role's landing page.
  if (!canViewFinance(user.role)) redirect(roleHome(user.role));

  // --- Bookings (agency-scoped via booking.agencyId) ----------------------
  // Pull every booking for the agency with its payments + client name. We
  // derive accounts-receivable, collected totals and confirmed revenue from
  // this single agency-scoped query, computing balances in code with
  // `paymentSummary`. Payments have no agencyId, so scoping flows through the
  // parent booking.
  const bookings = await db.query.booking.findMany({
    where: eq(booking.agencyId, user.agencyId),
    with: {
      payments: true,
      client: { columns: { name: true } },
    },
    limit: 1000,
  });

  const now = new Date();

  // Per-booking AR computed from completed payments (refunds subtracted).
  const receivables = bookings
    .filter((b) => b.status !== "cancelled")
    .map((b) => {
      const total = parseFloat(b.totalAmount || "0");
      const { paid, balance } = paymentSummary(b.payments, total);
      const isOverdue =
        !!b.departDate && new Date(b.departDate) < now && balance > 0.005;
      return { booking: b, total, paid, balance, isOverdue };
    });

  // Outstanding balance: sum of positive balances across non-cancelled bookings.
  const outstandingBalance = receivables.reduce(
    (sum, r) => sum + Math.max(r.balance, 0),
    0
  );

  // Collected: completed payments minus refunds across the whole agency.
  const collected = bookings.reduce(
    (sum, b) => sum + paymentSummary(b.payments, 0).paid,
    0
  );

  // Confirmed revenue: total of bookings marked confirmed/paid. The dashboard
  // uses this same defensive filter (the lifecycle later renames "paid").
  const confirmedRevenue = bookings
    .filter((b) => b.status === "confirmed" || b.status === "paid")
    .reduce((sum, b) => sum + parseFloat(b.totalAmount || "0"), 0);

  // Accounts receivable: outstanding (balance > 0), soonest departure first.
  const arRows = receivables
    .filter((r) => r.balance > 0.005)
    .sort((a, b) => {
      const da = a.booking.departDate
        ? new Date(a.booking.departDate).getTime()
        : Infinity;
      const dbb = b.booking.departDate
        ? new Date(b.booking.departDate).getTime()
        : Infinity;
      return da - dbb;
    });

  const overdueCount = receivables.filter((r) => r.isOverdue).length;

  // --- Recent payments (agency-scoped through the parent booking) ----------
  // Join payment → booking and filter by booking.agencyId so we never leak
  // another tenant's payments. Only completed payments, most recent first.
  const recentPayments = await db
    .select({
      id: payment.id,
      amount: payment.amount,
      kind: payment.kind,
      method: payment.method,
      currency: payment.currency,
      createdAt: payment.createdAt,
      bookingId: payment.bookingId,
      reference: booking.reference,
    })
    .from(payment)
    .innerJoin(booking, eq(payment.bookingId, booking.id))
    .where(
      and(
        eq(booking.agencyId, user.agencyId),
        eq(payment.status, "completed")
      )
    )
    .orderBy(desc(payment.createdAt))
    .limit(15);

  // --- Revenue summary extras (each query agency-scoped) -------------------
  // Agency margin proxy: sum of (totalPrice - totalCost) across the agency's
  // products. Won opportunity value: sum of opportunity.value where stage=won.
  const [products, wonOpportunities] = await Promise.all([
    db.query.product.findMany({
      where: eq(product.agencyId, user.agencyId),
      columns: { totalPrice: true, totalCost: true },
      limit: 1000,
    }),
    db.query.opportunity.findMany({
      where: and(
        eq(opportunity.agencyId, user.agencyId),
        eq(opportunity.stage, "won")
      ),
      columns: { value: true },
      limit: 1000,
    }),
  ]);

  const agencyMargin = products.reduce(
    (sum, p) =>
      sum + (parseFloat(p.totalPrice || "0") - parseFloat(p.totalCost || "0")),
    0
  );
  const wonValue = wonOpportunities.reduce(
    (sum, o) => sum + parseFloat(o.value || "0"),
    0
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Finance"
        description="Payments, accounts receivable and revenue across the agency."
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Outstanding balance"
          value={formatMoney(outstandingBalance)}
          hint={`${arRows.length} booking${arRows.length === 1 ? "" : "s"} with a balance`}
          icon={Wallet}
        />
        <StatCard
          label="Collected"
          value={formatMoney(collected)}
          hint="Completed payments, net of refunds"
          icon={CircleDollarSign}
        />
        <StatCard
          label="Confirmed revenue"
          value={formatMoney(confirmedRevenue)}
          hint="Confirmed & paid bookings"
          icon={TrendingUp}
        />
        <StatCard
          label="Overdue"
          value={overdueCount}
          hint={overdueCount ? "Past departure, still owing" : "All on track"}
          icon={AlertTriangle}
        />
      </div>

      {/* Accounts receivable */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="size-4" /> Accounts receivable
          </CardTitle>
        </CardHeader>
        <CardContent>
          {arRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No outstanding balances. Every booking is fully paid.
            </p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Departs</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {arRows.map((r) => {
                    const b = r.booking;
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          <Link
                            href={`/bookings/${b.id}`}
                            className="hover:underline"
                          >
                            {b.reference}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/bookings/${b.id}`}
                            className="font-medium hover:underline"
                          >
                            {b.client?.name ?? "—"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatDate(b.departDate)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(r.total, b.currency)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right">
                          {formatMoney(r.paid, b.currency)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatMoney(r.balance, b.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.isOverdue && (
                            <StatusBadge
                              label="Overdue"
                              tone="bg-red-500/15 text-red-600 dark:text-red-400"
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent payments */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="size-4" /> Recent payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No payments yet"
                description="Completed payments recorded against this agency's bookings will appear here."
              />
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Booking</TableHead>
                      <TableHead>Kind</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPayments.map((p) => {
                      const isRefund = p.kind === "refund";
                      const amount = parseFloat(p.amount || "0");
                      // Refunds reduce collected cash, so we show them negative & red.
                      const signed = isRefund ? -amount : amount;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="text-muted-foreground text-xs">
                            {formatDate(p.createdAt)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            <Link
                              href={`/bookings/${p.bookingId}`}
                              className="hover:underline"
                            >
                              {p.reference}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {PAYMENT_KIND_LABEL[p.kind as PaymentKind] ?? p.kind}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm capitalize">
                            {p.method}
                          </TableCell>
                          <TableCell
                            className={
                              isRefund
                                ? "text-right font-medium text-red-600 dark:text-red-400"
                                : "text-right font-medium"
                            }
                          >
                            {formatMoney(signed, p.currency)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4" /> Revenue summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground text-sm">
                  Confirmed revenue
                </dt>
                <dd className="font-semibold">{formatMoney(confirmedRevenue)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground text-sm">Collected</dt>
                <dd className="font-semibold">{formatMoney(collected)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground text-sm">
                  Agency margin
                  <span className="text-muted-foreground/70 ml-1 text-xs">
                    (proposals)
                  </span>
                </dt>
                <dd className="font-semibold">{formatMoney(agencyMargin)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground text-sm">
                  Won opportunities
                </dt>
                <dd className="font-semibold">{formatMoney(wonValue)}</dd>
              </div>
            </dl>
            <p className="text-muted-foreground/70 mt-4 text-xs">
              Agency margin is the sum of proposal price minus supplier cost
              across all products.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
