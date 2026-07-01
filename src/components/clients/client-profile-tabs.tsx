"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Briefcase,
  FileText,
  StickyNote,
  Target,
  Users,
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { AreaInsight } from "@/components/charts/insight-charts";
import {
  ClientTimeline,
  type TimelineEvent,
} from "@/components/clients/client-timeline";
import {
  ContactsManager,
  type Contact as ContactRow,
} from "@/components/clients/contacts-manager";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type TripRow = {
  id: string;
  reference: string;
  destination: string;
  flag: string | null;
  dates: string;
  amount: string;
  statusLabel: string;
  statusTone: string | undefined;
};

export type DealRow = {
  id: string;
  href: string;
  title: string;
  reference?: string | undefined;
  amount: string;
  statusLabel: string;
  statusTone: string | undefined;
};

type SpendPoint = { label: string; value: number };

/** A small pill that shows the count for a tab, mirroring the mockup. */
function TabCount({ n }: { n: number }) {
  return (
    <span className="bg-muted text-muted-foreground ml-0.5 rounded-full px-1.5 text-[11px] font-semibold tabular-nums">
      {n}
    </span>
  );
}

export function ClientProfileTabs({
  clientId,
  trips,
  lifetimeValue,
  avgPerTrip,
  opportunities,
  proposals,
  contacts,
  notes,
  spend,
  timelineEvents,
}: {
  clientId: string;
  trips: TripRow[];
  /** Formatted DZD lifetime total (for the trips-tab subtitle). */
  lifetimeValue: string;
  /** Formatted compact avg/trip (DZD), or null when no DZD bookings. */
  avgPerTrip: string | null;
  opportunities: DealRow[];
  proposals: DealRow[];
  contacts: ContactRow[];
  notes: string | null;
  spend: SpendPoint[];
  timelineEvents: TimelineEvent[];
}) {
  const t = useTranslations("clients");
  return (
    <Tabs defaultValue="overview" className="gap-5">
      <div className="overflow-x-auto">
        <TabsList variant="line" className="h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trips">
            Trips
            <TabCount n={trips.length} />
          </TabsTrigger>
          <TabsTrigger value="opportunities">
            Opportunities
            <TabCount n={opportunities.length} />
          </TabsTrigger>
          <TabsTrigger value="proposals">
            Proposals
            <TabCount n={proposals.length} />
          </TabsTrigger>
          <TabsTrigger value="contacts">
            Contacts
            <TabCount n={contacts.length} />
          </TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>
      </div>

      {/* ---------------- Overview ---------------- */}
      <TabsContent value="overview" className="space-y-5">
        <Card className="card-elevated">
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-base">
                {t("profile.spendOverTime")}
              </CardTitle>
              <p className="text-muted-foreground text-sm">
                {t("profile.spendSubtitle")}
              </p>
            </div>
            {avgPerTrip && (
              <div className="text-right">
                <p className="text-muted-foreground text-xs">
                  {t("profile.avgPerTrip")}
                </p>
                <p className="text-sm font-semibold tabular-nums">
                  {avgPerTrip}
                </p>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <AreaInsight
              data={spend}
              format="currency"
              currency="DZD"
              color="var(--brand)"
              height={200}
            />
          </CardContent>
        </Card>

        <ClientTimeline
          events={timelineEvents}
          logHref={`/clients/${clientId}/edit`}
        />
      </TabsContent>

      {/* ---------------- Trips ---------------- */}
      <TabsContent value="trips">
        <Card className="card-elevated overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="text-muted-foreground size-4" />
              {t("profile.tripHistory")}
            </CardTitle>
            {trips.length > 0 && (
              <p className="text-muted-foreground text-sm tabular-nums">
                {trips.length}{" "}
                {trips.length === 1 ? "booking" : "bookings"} · {lifetimeValue}{" "}
                {t("profile.lifetimeValue").toLowerCase()}
              </p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <TripsTable
              trips={trips}
              clientId={clientId}
              t={t}
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* ---------------- Opportunities ---------------- */}
      <TabsContent value="opportunities">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="text-muted-foreground size-4" />
              Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DealList
              rows={opportunities}
              emptyIcon={Target}
              emptyTitle="No opportunities yet"
              emptyDescription="Deals for this client will appear here."
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* ---------------- Proposals ---------------- */}
      <TabsContent value="proposals">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="text-muted-foreground size-4" />
              Proposals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DealList
              rows={proposals}
              emptyIcon={FileText}
              emptyTitle="No proposals yet"
              emptyDescription="Proposals built for this client will appear here."
              emptyAction={
                <Link
                  href={`/proposals/new?clientId=${clientId}`}
                  className="text-brand text-sm font-medium hover:underline"
                >
                  Build a proposal →
                </Link>
              }
            />
          </CardContent>
        </Card>
      </TabsContent>

      {/* ---------------- Contacts ---------------- */}
      <TabsContent value="contacts">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="text-muted-foreground size-4" />
              Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ContactsManager clientId={clientId} contacts={contacts} />
          </CardContent>
        </Card>
      </TabsContent>

      {/* ---------------- Notes ---------------- */}
      <TabsContent value="notes">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <StickyNote className="text-muted-foreground size-4" />
              Internal notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {notes ? (
              <p className="text-sm leading-6 whitespace-pre-wrap">{notes}</p>
            ) : (
              <EmptyState
                icon={StickyNote}
                title="No notes yet"
                description="Internal notes about this client will appear here."
                action={
                  <Link
                    href={`/clients/${clientId}/edit`}
                    className="text-brand text-sm font-medium hover:underline"
                  >
                    Add a note →
                  </Link>
                }
              />
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function TripsTable({
  trips,
  clientId,
  t,
}: {
  trips: TripRow[];
  clientId: string;
  t: ReturnType<typeof useTranslations>;
}) {
  if (trips.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Briefcase}
          title="No trips booked yet"
          description="Start the first booking to build this client's trip history."
          action={
            <Link
              href={`/bookings/new?clientId=${clientId}`}
              className="text-brand text-sm font-medium hover:underline"
            >
              Start the first booking →
            </Link>
          }
        />
      </div>
    );
  }
  return (
    <>
      <div className="max-h-[28rem] overflow-auto">
        <Table>
          <TableHeader sticky>
            <TableRow className="hover:bg-transparent">
              <TableHead>Reference</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Status</TableHead>
              <TableHead numeric>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trips.map((row) => (
              <TableRow key={row.id} className="group relative">
                <TableCell>
                  <Link
                    href={`/bookings/${row.id}`}
                    className="absolute inset-0 z-0"
                    aria-label={row.reference}
                  />
                  <span className="text-muted-foreground relative z-10 font-mono text-xs group-hover:underline">
                    {row.reference}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-2 font-medium">
                    {row.flag && (
                      <span aria-hidden className="text-base leading-none">
                        {row.flag}
                      </span>
                    )}
                    {row.destination}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {row.dates}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    label={row.statusLabel}
                    {...(row.statusTone ? { tone: row.statusTone } : {})}
                  />
                </TableCell>
                <TableCell numeric className="font-medium">
                  {row.amount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="text-muted-foreground flex items-center justify-between border-t px-5 py-3 text-sm">
        <span className="tabular-nums">
          {t("profile.showingOf", { shown: trips.length, total: trips.length })}
        </span>
      </div>
    </>
  );
}

function DealList({
  rows,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: {
  rows: DealRow[];
  emptyIcon: React.ComponentType<{ className?: string }>;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: React.ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        {...(emptyAction ? { action: emptyAction } : {})}
      />
    );
  }
  return (
    <ul className="divide-y">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={r.href}
            className={cn(
              "hover:bg-accent/40 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-3 transition-colors"
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              {r.reference && (
                <span className="text-muted-foreground shrink-0 font-mono text-xs">
                  {r.reference}
                </span>
              )}
              <span className="truncate font-medium">{r.title}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="text-sm font-medium tabular-nums">
                {r.amount}
              </span>
              <StatusBadge
                label={r.statusLabel}
                {...(r.statusTone ? { tone: r.statusTone } : {})}
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
