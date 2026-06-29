"use client";

import Link from "next/link";
import {
  Briefcase,
  FileText,
  StickyNote,
  Target,
  Users,
} from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import { BarInsight } from "@/components/charts/insight-charts";
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
  opportunities,
  proposals,
  contacts,
  notes,
  spend,
  timelineEvents,
}: {
  clientId: string;
  trips: TripRow[];
  opportunities: DealRow[];
  proposals: DealRow[];
  contacts: ContactRow[];
  notes: string | null;
  spend: SpendPoint[];
  timelineEvents: TimelineEvent[];
}) {
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
          <CardHeader>
            <CardTitle className="text-base">Spend over time</CardTitle>
            <p className="text-muted-foreground text-sm">
              Annual booked value (DZD) · last 5 years
            </p>
          </CardHeader>
          <CardContent>
            <BarInsight
              data={spend}
              format="currency"
              currency="DZD"
              color="var(--brand)"
              height={200}
            />
          </CardContent>
        </Card>

        <ClientTimeline events={timelineEvents} />
      </TabsContent>

      {/* ---------------- Trips ---------------- */}
      <TabsContent value="trips">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="text-muted-foreground size-4" />
              Trip history
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TripsTable trips={trips} clientId={clientId} />
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
              emptyLabel="No opportunities yet."
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
            <DealList rows={proposals} emptyLabel="No proposals yet." />
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
              <p className="text-muted-foreground text-sm">No notes yet.</p>
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
}: {
  trips: TripRow[];
  clientId: string;
}) {
  if (trips.length === 0) {
    return (
      <div className="text-muted-foreground space-y-3 py-6 text-center text-sm">
        <p>No trips booked yet.</p>
        <Link
          href={`/bookings/new?clientId=${clientId}`}
          className="text-brand font-medium hover:underline"
        >
          Start the first booking →
        </Link>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground border-b text-left text-xs">
            <th className="py-2 pr-3 font-medium">Reference</th>
            <th className="py-2 pr-3 font-medium">Destination</th>
            <th className="py-2 pr-3 font-medium">Dates</th>
            <th className="py-2 pr-3 font-medium">Status</th>
            <th className="py-2 pl-3 text-right font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {trips.map((t) => (
            <tr
              key={t.id}
              className="hover:bg-accent/40 border-b transition-colors last:border-0"
            >
              <td className="py-3 pr-3">
                <Link
                  href={`/bookings/${t.id}`}
                  className="text-muted-foreground font-mono text-xs hover:underline"
                >
                  {t.reference}
                </Link>
              </td>
              <td className="py-3 pr-3">
                <Link
                  href={`/bookings/${t.id}`}
                  className="flex items-center gap-2 font-medium hover:underline"
                >
                  {t.flag && (
                    <span aria-hidden className="text-base leading-none">
                      {t.flag}
                    </span>
                  )}
                  {t.destination}
                </Link>
              </td>
              <td className="text-muted-foreground py-3 pr-3 tabular-nums">
                {t.dates}
              </td>
              <td className="py-3 pr-3">
                <StatusBadge
                  label={t.statusLabel}
                  {...(t.statusTone ? { tone: t.statusTone } : {})}
                />
              </td>
              <td className="py-3 pl-3 text-right font-medium tabular-nums">
                {t.amount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DealList({
  rows,
  emptyLabel,
}: {
  rows: DealRow[];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyLabel}</p>;
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
