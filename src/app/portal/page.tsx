import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  ArrowRight,
  CheckCircle2,
  FileSignature,
  Luggage,
  Mail,
  MessageCircle,
  Phone,
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { StatusPill } from "@/components/app/status-badge";
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
  BOOKING_STATUS_META,
  type BookingStatus,
} from "@/lib/domain";
import { formatDate, formatMoney, formatRelative, initials } from "@/lib/format";
import { requirePortalSession } from "@/lib/portal-session";
import { booking, client, product } from "@/lib/schema";

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

export default async function PortalPage() {
  const session = await requirePortalSession();
  const currency = "DZD"; // Money is DZD-only across the portal (no FX).

  // Scope strictly to this client AND their agency (defence in depth).
  const bookings = await db.query.booking.findMany({
    where: and(
      eq(booking.clientId, session.client.id),
      eq(booking.agencyId, session.client.agencyId)
    ),
    columns: {
      id: true,
      reference: true,
      status: true,
      destination: true,
      departDate: true,
      returnDate: true,
    },
    with: {
      travellers: {
        columns: {
          id: true,
          fullName: true,
          passportNumber: true,
          passportExpiry: true,
          isLead: true,
        },
        orderBy: (t, { asc, desc }) => [desc(t.isLead), asc(t.sortOrder)],
      },
    },
    orderBy: [desc(booking.createdAt)],
  });

  if (bookings.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {session.client.name}.
          </h1>
          <p className="text-muted-foreground">
            Your trips with us will appear here.
          </p>
        </div>
        <EmptyState
          icon={Luggage}
          title="No trips yet"
          description="No trips found for your account yet. Your agent will add your bookings here."
        />
      </div>
    );
  }

  // The "next trip" = the soonest confirmed/upcoming booking with a future
  // departure; fall back to the most recent booking overall.
  const upcoming = bookings
    .filter((b) => (b.departDate ? new Date(b.departDate) > new Date() : false))
    .sort(
      (a, b) =>
        new Date(a.departDate!).getTime() - new Date(b.departDate!).getTime()
    );
  const featured = upcoming[0] ?? bookings[0]!;

  // The travel agent who owns this client relationship (real user row).
  const clientRow = await db.query.client.findFirst({
    where: eq(client.id, session.client.id),
    columns: { phone: true },
    with: {
      owner: { columns: { name: true, email: true } },
    },
  });
  const agent = clientRow?.owner ?? null;

  // A proposal awaiting the client's signature (open + not yet acted on).
  const pendingProposal = await db.query.product.findFirst({
    where: and(
      eq(product.clientId, session.client.id),
      eq(product.agencyId, session.client.agencyId)
    ),
    columns: {
      id: true,
      reference: true,
      title: true,
      status: true,
      totalPrice: true,
      validUntil: true,
      destination: true,
    },
    with: {
      items: {
        columns: { id: true, title: true },
        orderBy: (items) => [asc(items.sortOrder)],
        limit: 4,
      },
    },
    orderBy: [desc(product.createdAt)],
  });
  const proposalNeedsSignature =
    pendingProposal &&
    (pendingProposal.status === "draft" || pendingProposal.status === "sent") &&
    (!pendingProposal.validUntil ||
      new Date(pendingProposal.validUntil).getTime() > new Date().getTime());

  // ---- Derive hero fields from the featured booking ----
  const featuredMeta = BOOKING_STATUS_META[featured.status as BookingStatus];
  const nights = nightsBetween(featured.departDate, featured.returnDate);
  const travellerCount = featured.travellers.length;
  const subParts: string[] = [];
  if (featured.departDate) {
    subParts.push(
      featured.returnDate
        ? `${formatDate(featured.departDate)} — ${formatDate(featured.returnDate)}`
        : formatDate(featured.departDate)
    );
  }
  if (nights) subParts.push(`${nights} ${nights === 1 ? "night" : "nights"}`);
  if (travellerCount)
    subParts.push(
      `${travellerCount} ${travellerCount === 1 ? "traveller" : "travellers"}`
    );

  const heroMeta: TripHeroMeta[] = [];
  if (featured.destination)
    heroMeta.push({ label: "Destination", value: featured.destination });
  heroMeta.push({ label: "Booking ref", value: featured.reference });
  if (nights) heroMeta.push({ label: "Duration", value: `${nights} nights` });
  if (agent?.name) heroMeta.push({ label: "Your agent", value: agent.name });

  const countdown = daysUntil(featured.departDate);
  // Weekday + date caption under the countdown (weekday is derived from the
  // real depart date — no fabricated time is shown).
  const countdownFoot = featured.departDate
    ? formatWeekdayDate(featured.departDate)
    : undefined;

  return (
    <div className="space-y-7">
      {/* Welcome */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Welcome back, {session.client.name}.
        </h1>
        <p className="text-muted-foreground">
          {featured.destination
            ? `Your trip to ${featured.destination} — everything in one place.`
            : "Everything about your trips, in one place."}
        </p>
      </div>

      {/* Trip hero */}
      <TripHero
        eyebrow="Your next trip"
        statusLabel={featuredMeta?.label ?? featured.status}
        title={featured.destination ?? "Your trip"}
        subParts={subParts}
        meta={heroMeta}
        countdownDays={countdown}
        countdownFoot={countdownFoot}
        packHref={`/portal/bookings/${featured.id}#documents`}
        itineraryHref={`/portal/bookings/${featured.id}#itinerary`}
        supportHref="#support"
        agentName={agent?.name ?? undefined}
      />

      {/* Two-column layout with ~340px right rail */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_340px]">
        {/* MAIN COLUMN */}
        <div className="space-y-6">
          {/* Awaiting your signature */}
          {proposalNeedsSignature && pendingProposal && (
            <section id="signature">
              <TintPanel>
                <span className="text-primary mb-2.5 inline-flex items-center gap-1.5 text-[11.5px] font-bold tracking-[0.04em] uppercase">
                  <FileSignature className="size-4" />
                  Awaiting your signature
                </span>
                <div className="text-base font-semibold tracking-tight">
                  {pendingProposal.title}
                </div>
                <p className="text-muted-foreground mt-2 text-sm">
                  Proposal{" "}
                  <strong className="text-foreground font-semibold">
                    {pendingProposal.reference}
                  </strong>{" "}
                  — please review and sign to lock in your dates.
                </p>

                {pendingProposal.items.length > 0 && (
                  <div className="my-3.5 flex flex-col gap-2">
                    {pendingProposal.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2.5 text-sm"
                      >
                        <CheckCircle2 className="size-4 shrink-0 text-success" />
                        {item.title}
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-primary/20 mt-3.5 flex items-center justify-between gap-3 border-t pt-3.5">
                  <div>
                    <div className="text-lg font-bold tracking-tight">
                      {formatMoney(pendingProposal.totalPrice, currency)}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {pendingProposal.validUntil
                        ? `Valid until ${formatDate(pendingProposal.validUntil)}`
                        : "All taxes included"}
                    </div>
                  </div>
                  <Button asChild>
                    <Link href={`/portal/proposals/${pendingProposal.id}`}>
                      <FileSignature className="mr-1 size-4" />
                      Review &amp; sign
                    </Link>
                  </Button>
                </div>
              </TintPanel>
            </section>
          )}

          {/* My trips */}
          <section id="trips">
            <SectionHead
              title="My trips"
              hint={`${bookings.length} ${bookings.length === 1 ? "trip" : "trips"}`}
            />
            <div className="space-y-2.5">
              {bookings.map((b, i) => {
                const meta = BOOKING_STATUS_META[b.status as BookingStatus];
                const bn = nightsBetween(b.departDate, b.returnDate);
                return (
                  <Link
                    key={b.id}
                    href={`/portal/bookings/${b.id}`}
                    className="group focus-visible:ring-ring flex items-center gap-4 rounded-lg border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span
                      className={`inline-flex size-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white ${tripGradient(i)}`}
                    >
                      <Luggage className="size-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">
                        {b.destination ?? "Trip"}
                      </div>
                      <div className="text-muted-foreground mt-0.5 text-sm">
                        {[
                          b.departDate && b.returnDate
                            ? `${formatDate(b.departDate)} — ${formatDate(b.returnDate)}`
                            : b.departDate
                              ? formatDate(b.departDate)
                              : null,
                          bn ? `${bn} nights` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                      <div className="text-muted-foreground/70 mt-0.5 font-mono text-xs">
                        {b.reference}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {meta ? (
                        <StatusPill
                          domain="booking"
                          status={b.status}
                          label={meta.label}
                        />
                      ) : (
                        <Badge variant="secondary">{b.status}</Badge>
                      )}
                      {b.departDate && (
                        <div className="text-muted-foreground/70 mt-2 text-xs">
                          {formatRelative(b.departDate)}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
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

          {/* Travellers (from the featured trip) */}
          {featured.travellers.length > 0 && (
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-base">Travellers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-0">
                {featured.travellers.map((t, i) => (
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
              {featured.destination && (
                <InfoLine label="Destination">{featured.destination}</InfoLine>
              )}
              {featured.departDate && (
                <InfoLine label="Departs">
                  {formatDate(featured.departDate)}
                </InfoLine>
              )}
              {nights && <InfoLine label="Duration">{nights} nights</InfoLine>}
              <InfoLine label="Booking ref">{featured.reference}</InfoLine>
              <InfoLine label="Status">
                {featuredMeta ? (
                  <StatusPill
                    domain="booking"
                    status={featured.status}
                    label={featuredMeta.label}
                  />
                ) : (
                  <Badge variant="secondary">{featured.status}</Badge>
                )}
              </InfoLine>
            </CardContent>
          </Card>

          {/* Help / tip panel */}
          <TintPanel>
            <div className="mb-2 text-sm font-semibold">Travelling soon?</div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Check your travel documents, passport validity and payment status
              — or just message your agent with any question.
            </p>
            <Link
              href={`/portal/bookings/${featured.id}`}
              className="text-primary mt-3 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
            >
              Open trip details
              <ArrowRight className="size-3.5" />
            </Link>
          </TintPanel>
        </aside>
      </div>
    </div>
  );
}
