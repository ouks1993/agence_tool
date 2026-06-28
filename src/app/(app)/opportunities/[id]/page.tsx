import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import {
  ArrowLeft,
  Pencil,
  Plus,
  MapPin,
  Users,
  Calendar,
  FileText,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { DeleteOpportunityButton } from "@/components/opportunities/delete-opportunity-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import {
  OPPORTUNITY_STAGE_META,
  PRODUCT_STATUS_META,
  seesAllData,
  type OpportunityStage,
  type ProductStatus,
} from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { requireAgencyUser } from "@/lib/permissions";
import { opportunity } from "@/lib/schema";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAgencyUser();
  const { id } = await params;

  const o = await db.query.opportunity.findFirst({
    // Agents may only open opportunities assigned to them (others see all).
    where: and(
      eq(opportunity.id, id),
      eq(opportunity.agencyId, user.agencyId),
      seesAllData(user.role) ? undefined : eq(opportunity.assignedToId, user.id)
    ),
    with: {
      client: { columns: { id: true, name: true } },
      assignedTo: { columns: { name: true } },
      products: { orderBy: (t) => [desc(t.createdAt)] },
    },
  });
  if (!o) notFound();

  const stageMeta = OPPORTUNITY_STAGE_META[o.stage as OpportunityStage];

  const detail = [
    { icon: MapPin, label: "Destination", value: o.destination ?? "—" },
    { icon: Users, label: "Travellers", value: String(o.paxCount) },
    {
      icon: Calendar,
      label: "Travel dates",
      value:
        o.travelStartDate || o.travelEndDate
          ? `${formatDate(o.travelStartDate)} → ${formatDate(o.travelEndDate)}`
          : "—",
    },
    { icon: Calendar, label: "Expected close", value: formatDate(o.expectedCloseDate) },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/opportunities">
          <ArrowLeft className="mr-1 size-4" />
          Opportunities
        </Link>
      </Button>

      <PageHeader title={o.title}>
        <Button asChild variant="outline" size="sm">
          <Link href={`/opportunities/${o.id}/edit`}>
            <Pencil className="mr-2 size-4" />
            Edit
          </Link>
        </Button>
        <DeleteOpportunityButton id={o.id} title={o.title} />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={stageMeta?.label ?? o.stage} tone={stageMeta?.badgeClass} />
        <StatusBadge label={`${o.probability}% probability`} />
        {o.client && (
          <Link
            href={`/clients/${o.client.id}`}
            className="text-muted-foreground text-sm hover:underline"
          >
            {o.client.name}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4" /> Proposals
              </CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/products/new?opportunityId=${o.id}${
                    o.client ? `&clientId=${o.client.id}` : ""
                  }`}
                >
                  <Plus className="mr-1 size-4" />
                  New proposal
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {o.products.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No proposals linked yet.
                </p>
              ) : (
                <ul className="divide-y">
                  {o.products.map((p) => {
                    const meta = PRODUCT_STATUS_META[p.status as ProductStatus];
                    return (
                      <li key={p.id} className="py-3">
                        <Link
                          href={`/products/${p.id}`}
                          className="flex items-center justify-between gap-3 hover:underline"
                        >
                          <span className="min-w-0 truncate">
                            <span className="text-muted-foreground mr-2 text-xs">
                              {p.reference}
                            </span>
                            <span className="font-medium">{p.title}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-3">
                            <span className="text-muted-foreground text-sm">
                              {formatMoney(p.totalPrice, p.currency)}
                            </span>
                            <StatusBadge
                              label={meta?.label ?? p.status}
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

          {o.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{o.notes}</p>
              </CardContent>
            </Card>
          )}

          {o.stage === "lost" && o.lostReason && (
            <Card>
              <CardHeader>
                <CardTitle className="text-destructive text-base">
                  Reason lost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{o.lostReason}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-1 p-6 text-center">
              <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-sm">
                <Target className="size-4" /> Estimated value
              </p>
              <p className="text-3xl font-bold">{formatMoney(o.value, o.currency)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {detail.map((d) => {
                const Icon = d.icon;
                return (
                  <div key={d.label} className="flex items-start gap-2">
                    <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="text-muted-foreground text-xs">{d.label}</p>
                      <p>{d.value}</p>
                    </div>
                  </div>
                );
              })}
              <div className="text-muted-foreground border-t pt-3 text-xs">
                <p>Assigned to: {o.assignedTo?.name ?? "Unassigned"}</p>
                <p>Created: {formatDate(o.createdAt)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
