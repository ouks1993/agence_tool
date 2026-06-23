import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Mail,
  Phone,
  MapPin,
  Building2,
  Briefcase,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { ContactsManager } from "@/components/clients/contacts-manager";
import { DeleteClientButton } from "@/components/clients/delete-client-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import {
  CLIENT_STATUS_META,
  BOOKING_STATUS_META,
  type ClientStatus,
  type BookingStatus,
} from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { requireUser } from "@/lib/permissions";
import { client } from "@/lib/schema";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const c = await db.query.client.findFirst({
    where: eq(client.id, id),
    with: {
      owner: { columns: { id: true, name: true } },
      contacts: { orderBy: (t, { desc }) => [desc(t.isPrimary)] },
      bookings: {
        orderBy: (t) => [desc(t.createdAt)],
      },
    },
  });

  if (!c) notFound();

  const statusMeta = CLIENT_STATUS_META[c.status as ClientStatus];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/clients">
          <ArrowLeft className="mr-1 size-4" />
          Clients
        </Link>
      </Button>

      <PageHeader title={c.name}>
        <Button asChild variant="outline" size="sm">
          <Link href={`/clients/${c.id}/edit`}>
            <Pencil className="mr-2 size-4" />
            Edit
          </Link>
        </Button>
        <DeleteClientButton id={c.id} name={c.name} />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={statusMeta?.label ?? c.status} tone={statusMeta?.badgeClass} />
        <StatusBadge label={c.type === "corporate" ? "Corporate" : "Individual"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Bookings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="size-4" /> Bookings
              </CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link href={`/bookings/new?clientId=${c.id}`}>
                  <Plus className="mr-1 size-4" />
                  New
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {c.bookings.length === 0 ? (
                <p className="text-muted-foreground text-sm">No bookings yet.</p>
              ) : (
                <ul className="divide-y">
                  {c.bookings.map((b) => {
                    const meta = BOOKING_STATUS_META[b.status as BookingStatus];
                    return (
                      <li key={b.id} className="py-3">
                        <Link
                          href={`/bookings/${b.id}`}
                          className="flex items-center justify-between gap-3 hover:underline"
                        >
                          <span className="min-w-0 truncate">
                            <span className="text-muted-foreground mr-2 text-xs">
                              {b.reference}
                            </span>
                            <span className="font-medium">
                              {b.destination ?? "Trip"}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-3">
                            <span className="text-muted-foreground text-sm">
                              {formatMoney(b.totalAmount, b.currency)}
                            </span>
                            <StatusBadge
                              label={meta?.label ?? b.status}
                              tone={meta?.badgeClass}
                            />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Contacts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              <ContactsManager clientId={c.id} contacts={c.contacts} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {c.email && (
                <p className="flex items-center gap-2">
                  <Mail className="text-muted-foreground size-4" />
                  <a href={`mailto:${c.email}`} className="hover:underline">
                    {c.email}
                  </a>
                </p>
              )}
              {c.phone && (
                <p className="flex items-center gap-2">
                  <Phone className="text-muted-foreground size-4" />
                  {c.phone}
                </p>
              )}
              {c.company && (
                <p className="flex items-center gap-2">
                  <Building2 className="text-muted-foreground size-4" />
                  {c.company}
                </p>
              )}
              {(c.city || c.country || c.address) && (
                <p className="flex items-start gap-2">
                  <MapPin className="text-muted-foreground mt-0.5 size-4" />
                  <span>
                    {[c.address, c.city, c.country].filter(Boolean).join(", ")}
                  </span>
                </p>
              )}
              <div className="text-muted-foreground space-y-1 border-t pt-3 text-xs">
                <p>Owner: {c.owner?.name ?? "Unassigned"}</p>
                {c.source && <p>Source: {c.source}</p>}
                <p>Added: {formatDate(c.createdAt)}</p>
              </div>
            </CardContent>
          </Card>

          {c.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{c.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
