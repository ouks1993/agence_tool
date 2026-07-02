import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import {
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Mail,
  MessageCircle,
  Phone,
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { StatusPill } from "@/components/app/status-badge";
import { PaymentOptions } from "@/components/portal/payment-options";
import {
  InfoLine,
  SectionHead,
  TintPanel,
  TripStatusPill,
  tripGradient,
} from "@/components/portal/portal-bits";
import { TripHero, type TripHeroMeta } from "@/components/portal/trip-hero";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { formatDate, formatMoney, initials } from "@/lib/format";
import { depositAmount } from "@/lib/payments/deposit";
import { paymentSummary } from "@/lib/payments/summary";
import { requirePortalSession } from "@/lib/portal-session";
import { agency, booking, client } from "@/lib/schema";

/** Whole days from now until a future date, or null when unknown/past. */
function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  if (ms <= 0) return null;
  return Math.ceil(ms / 86_400_000);
}

/** Inclusive night count between two dates, or null when either is missing. */
function nightsBetween(
  start: Date | null | undefined,
  end: Date | null | undefined
): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return null;
  return Math.round(ms / 86_400_000);
}

/** "Sunday, 2 Aug" — weekday + short date, matching the deck countdown foot. */
function formatWeekdayDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(d);
}

/** Human label for a document type code. */
const DOC_TYPE_LABEL: Record<string, string> = {
  voucher: "Voucher",
  ticket: "E-ticket",
  invoice: "Invoice",
  itinerary: "Itinerary",
  receipt: "Receipt",
};

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
  const currency = "DZD"; // Money is DZD-only across the portal (no FX).

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
      travellers: {
        orderBy: (t, { asc, desc }) => [desc(t.isLead), asc(t.sortOrder)],
      },
      documents: {
        orderBy: (d, { desc }) => [desc(d.createdAt)],
      },
    },
  });

  if (!b) notFound();

  // Online self-pay is only offered once the agency has finished Stripe Connect.
  const ag = await db.query.agency.findFirst({
    where: eq(agency.id, session.client.agencyId),
    columns: { stripeConnectOnboarded: true, depositPercent: true },
  });
  const canPayOnline = ag?.stripeConnectOnboarded === true;
  const depositPercent = parseFloat(ag?.depositPercent ?? "50");

  // The travel agent who owns this client relationship (real user row).
  const clientRow = await db.query.client.findFirst({
    where: eq(client.id, session.client.id),
    columns: { phone: true },
    with: { owner: { columns: { name: true, email: true } } },
  });
  const agent = clientRow?.owner ?? null;

  const statusMeta = BOOKING_STATUS_META[b.status as BookingStatus];

  // Payment maths: refunds subtracted, only completed rows counted.
  const total = parseFloat(b.totalAmount ?? "0");
  const { paid: totalPaid, balance } = paymentSummary(b.payments, total);
  const paidPct = total > 0 ? Math.min(100, Math.round((totalPaid / total) * 100)) : 0;
  // Remainder still needed to reach the agency's deposit threshold (display
  // only — the pay action recomputes this server-side). <= 0 once covered.
  const depositDue = Math.max(0, depositAmount(total, depositPercent) - totalPaid);

  // ---- Hero derivations ----
  const nights = nightsBetween(b.departDate, b.returnDate);
  const travellerCount = b.travellers.length;
  const subParts: string[] = [];
  if (b.departDate) {
    subParts.push(
      b.returnDate
        ? `${formatDate(b.departDate)} — ${formatDate(b.returnDate)}`
        : formatDate(b.departDate)
    );
  }
  if (nights) subParts.push(`${nights} ${nights === 1 ? "night" : "nights"}`);
  if (travellerCount)
    subParts.push(
      `${travellerCount} ${travellerCount === 1 ? "traveller" : "travellers"}`
    );

  const heroMeta: TripHeroMeta[] = [];
  if (b.destination)
    heroMeta.push({ label: "Destination", value: b.destination });
  heroMeta.push({ label: "Booking ref", value: b.reference });
  if (nights) heroMeta.push({ label: "Duration", value: `${nights} nights` });
  if (agent?.name) heroMeta.push({ label: "Your agent", value: agent.name });

  const countdown = daysUntil(b.departDate);
  const countdownFoot = b.departDate
    ? formatWeekdayDate(b.departDate)
    : undefined;

  return (
    <div className="space-y-7">
      {/* Back link */}
      <Link
        href="/portal"
        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
      >
        ← Back to my trips
      </Link>

      {/* Payment success banner (from Stripe redirect) */}
      {paid === "1" && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success-soft p-4 text-sm text-success">
          <CheckCircle2 className="size-5 shrink-0" />
          <span>Payment received — thank you!</span>
        </div>
      )}

      {/* Trip hero */}
      <TripHero
        eyebrow="Your trip"
        statusLabel={statusMeta?.label ?? b.status}
        title={b.destination ?? "Your trip"}
        subParts={subParts}
        meta={heroMeta}
        countdownDays={countdown}
        countdownFoot={countdownFoot}
        packHref="#documents"
        itineraryHref={b.shareToken ? `/i/${b.shareToken}` : "#itinerary"}
        supportHref="#support"
        agentName={agent?.name ?? undefined}
      />

      {/* Two-column layout with ~340px right rail */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_340px]">
        {/* MAIN COLUMN */}
        <div className="space-y-6">
          {/* Itinerary */}
          <section id="itinerary">
            <SectionHead
              title="Itinerary"
              hint={`Booking ${b.reference}`}
            />
            <Card className="card-elevated">
              <CardContent className="divide-y py-2">
                {b.items.map((item) => {
                  const typeMeta =
                    BOOKING_ITEM_TYPE_META[item.type as BookingItemType];
                  const meta: string[] = [typeMeta?.label ?? item.type];
                  if (item.supplier) meta.push(item.supplier);
                  if (item.startDate) meta.push(formatDate(item.startDate));
                  if (item.confirmationNumber)
                    meta.push(`Ref: ${item.confirmationNumber}`);
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-muted-foreground text-xs">
                          {meta.join(" · ")}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold tabular-nums">
                          {formatMoney(
                            parseFloat(item.amount || "0") * item.quantity,
                            currency
                          )}
                        </p>
                        {item.itemStatus === "confirmed" && (
                          <span className="text-xs text-success">
                            Confirmed
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {b.items.length === 0 && (
                  <p className="text-muted-foreground py-3 text-sm">
                    No itinerary items yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          {/*
            Documents — a first-class section (the hero's "Travel documents" CTA
            anchors here). Always rendered so the anchor resolves; shows a
            branded empty state until the agent uploads real documents.
          */}
          <section id="documents">
            <SectionHead title="Documents" />
            <Card className="card-elevated">
              <CardContent className="py-2">
                {b.documents.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="No documents yet"
                    description="Your travel pack, e-tickets and vouchers will appear here once your agent uploads them."
                    className="border-0 py-8"
                  />
                ) : (
                  <div className="flex flex-col">
                    {b.documents.map((doc) => {
                      const label =
                        DOC_TYPE_LABEL[doc.type] ?? doc.type;
                      return (
                        <div
                          key={doc.id}
                          className="flex items-center gap-3.5 border-b py-3 last:border-b-0"
                        >
                          <span className="bg-accent text-primary inline-flex size-9 shrink-0 items-center justify-center rounded-md">
                            <FileText className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {label}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {[
                                doc.providerId,
                                doc.generatedAt
                                  ? formatDate(doc.generatedAt)
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "Ready to download"}
                            </div>
                          </div>
                          {doc.url && (
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                            >
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Download className="mr-1 size-3.5" />
                                Download
                              </a>
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Payments */}
          <section id="payments">
            <SectionHead title="Payments" hint={`Booking ${b.reference}`} />
            <Card className="card-elevated">
              <CardContent className="space-y-5 py-6">
                {/* Summary cells */}
                <div className="grid grid-cols-3 divide-x overflow-hidden rounded-lg border">
                  <div className="p-4">
                    <div className="text-muted-foreground text-xs">
                      Trip total
                    </div>
                    <div className="mt-1 text-lg font-bold tracking-tight tabular-nums">
                      {formatMoney(total, currency)}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-muted-foreground text-xs">
                      Paid to date
                    </div>
                    <div className="mt-1 text-lg font-bold tracking-tight tabular-nums text-success">
                      {formatMoney(totalPaid, currency)}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-muted-foreground text-xs">
                      Balance due
                    </div>
                    <div
                      className={`mt-1 text-lg font-bold tracking-tight tabular-nums ${balance > 0 ? "text-warning" : ""}`}
                    >
                      {formatMoney(Math.max(0, balance), currency)}
                    </div>
                  </div>
                </div>

                {/* Progress */}
                {total > 0 && (
                  <div>
                    <div className="text-muted-foreground mb-1.5 flex justify-between text-xs">
                      <span>{paidPct}% paid</span>
                      {balance > 0 && <span>Balance outstanding</span>}
                    </div>
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full bg-success transition-all"
                        style={{ width: `${paidPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Balance-due banner + pay-now (preserves Stripe Connect flow) */}
                {balance > 0 && (
                  <div className="flex flex-wrap items-center gap-4 rounded-lg border border-warning/30 bg-warning-soft p-4">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-warning-soft text-warning">
                      <CreditCardIcon />
                    </span>
                    <div className="min-w-[8rem] flex-1">
                      <div className="text-sm font-semibold text-warning">
                        Balance due
                      </div>
                      <div className="text-xs text-warning/80">
                        Settle the remaining balance to confirm your trip.
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold tracking-tight tabular-nums text-warning">
                        {formatMoney(balance, currency)}
                      </div>
                      {canPayOnline && (
                        <div className="mt-2 flex justify-end">
                          <PaymentOptions
                            bookingId={b.id}
                            balance={balance}
                            depositDue={depositDue}
                            depositPercent={depositPercent}
                            currency={currency}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Payment history */}
                {b.payments.length > 0 && (
                  <div>
                    <div className="mb-1 text-sm font-semibold">
                      Payment history
                    </div>
                    {b.payments.map((p) => {
                      const done = p.status === "completed";
                      return (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 border-b py-3 text-sm last:border-b-0"
                        >
                          <span
                            className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full ${
                              done
                                ? "bg-success-soft text-success"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {done ? (
                              <CheckCircle2 className="size-4" />
                            ) : (
                              <Clock className="size-4" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">
                              {PAYMENT_KIND_LABEL[p.kind as PaymentKind] ??
                                p.kind}
                            </div>
                            <div className="text-muted-foreground text-xs capitalize">
                              {p.method} · {p.status}
                              {p.createdAt
                                ? ` · ${formatDate(p.createdAt)}`
                                : ""}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 font-semibold tabular-nums ${
                              done
                                ? "text-success"
                                : "text-muted-foreground"
                            }`}
                          >
                            {formatMoney(p.amount, currency)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        {/* RIGHT RAIL */}
        <aside className="space-y-5">
          {/* Travel agent */}
          <Card id="support" className="card-elevated">
            <CardHeader>
              <CardTitle className="text-base">Your travel agent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {agent ? (
                <>
                  <div className="flex items-center gap-3 border-b pb-3.5">
                    <Avatar className="size-11">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {initials(agent.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{agent.name}</div>
                      <div className="text-muted-foreground text-sm">
                        Travel consultant
                      </div>
                    </div>
                  </div>
                  {agent.email && (
                    <a
                      href={`mailto:${agent.email}`}
                      className="text-foreground hover:text-primary flex items-center gap-2.5 text-sm transition-colors"
                    >
                      <Mail className="text-muted-foreground size-4 shrink-0" />
                      <span className="truncate">{agent.email}</span>
                    </a>
                  )}
                  {clientRow?.phone && (
                    <a
                      href={`tel:${clientRow.phone}`}
                      className="text-foreground hover:text-primary flex items-center gap-2.5 text-sm transition-colors"
                    >
                      <Phone className="text-muted-foreground size-4 shrink-0" />
                      <span className="truncate">{clientRow.phone}</span>
                    </a>
                  )}
                  {agent.email && (
                    <Button asChild className="w-full">
                      <a href={`mailto:${agent.email}`}>
                        <MessageCircle className="mr-1 size-4" />
                        Message {agent.name.split(/\s+/)[0]}
                      </a>
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Your agent&apos;s contact details will appear here.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Travellers */}
          {b.travellers.length > 0 && (
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-base">Travellers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-0">
                {b.travellers.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-3 py-2">
                    <Avatar className="size-9">
                      <AvatarFallback
                        className={`bg-gradient-to-br text-xs font-semibold text-white ${tripGradient(i + 1)}`}
                      >
                        {initials(t.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {t.fullName}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {t.passportNumber
                          ? `Passport ${t.passportNumber}`
                          : "Passport on file"}
                        {t.passportExpiry
                          ? ` · exp ${new Date(t.passportExpiry).getFullYear()}`
                          : ""}
                      </div>
                    </div>
                    {t.passportNumber && (
                      <TripStatusPill
                        label="Verified"
                        className="bg-success-soft text-success"
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Trip at a glance */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-base">Trip at a glance</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {b.destination && (
                <InfoLine label="Destination">{b.destination}</InfoLine>
              )}
              {b.departDate && (
                <InfoLine label="Departs">{formatDate(b.departDate)}</InfoLine>
              )}
              {b.returnDate && (
                <InfoLine label="Returns">{formatDate(b.returnDate)}</InfoLine>
              )}
              {nights && <InfoLine label="Duration">{nights} nights</InfoLine>}
              <InfoLine label="Booking ref">{b.reference}</InfoLine>
              <InfoLine label="Status">
                {statusMeta ? (
                  <StatusPill
                    domain="booking"
                    status={b.status}
                    label={statusMeta.label}
                  />
                ) : (
                  <Badge variant="secondary">{b.status}</Badge>
                )}
              </InfoLine>
            </CardContent>
          </Card>

          {/* Shareable itinerary link (public, read-only) */}
          {b.shareToken && (
            <TintPanel>
              <div className="mb-2 text-sm font-semibold">
                Share your itinerary
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                A read-only view of your trip you can share with anyone.
              </p>
              <Link
                href={`/i/${b.shareToken}`}
                className="text-primary mt-3 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
              >
                View shareable itinerary →
              </Link>
            </TintPanel>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Small inline credit-card glyph for the balance banner. */
function CreditCardIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}
