import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import {
  ArrowLeft,
  Pencil,
  MapPin,
  Users,
  Calendar,
  CalendarClock,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { ConvertToBookingButton } from "@/components/products/convert-to-booking-button";
import { DeleteProductButton } from "@/components/products/delete-product-button";
import { ItemsManager } from "@/components/products/items-manager";
import { ProductStatusControl } from "@/components/products/product-status-control";
import { ProposalShareControl } from "@/components/products/proposal-share-control";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSuppliersForPicker } from "@/lib/actions/suppliers";
import { db } from "@/lib/db";
import {
  PRODUCT_STATUS_META,
  seesAllData,
  type ProductStatus,
} from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { requireAgencyUser } from "@/lib/permissions";
import { product } from "@/lib/schema";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAgencyUser();
  const { id } = await params;

  const [p, suppliers] = await Promise.all([
    db.query.product.findFirst({
      // Agents may only open proposals they created (others see all).
      where: and(
        eq(product.id, id),
        eq(product.agencyId, user.agencyId),
        seesAllData(user.role) ? undefined : eq(product.createdById, user.id)
      ),
      with: {
        client: { columns: { id: true, name: true } },
        opportunity: { columns: { id: true, title: true } },
        items: { orderBy: (t) => [asc(t.sortOrder)] },
      },
    }),
    getSuppliersForPicker(),
  ]);
  if (!p) notFound();

  const meta = PRODUCT_STATUS_META[p.status as ProductStatus];
  const totalCost = parseFloat(p.totalCost || "0");
  const totalPrice = parseFloat(p.totalPrice || "0");
  const margin = totalPrice - totalCost;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/products">
          <ArrowLeft className="mr-1 size-4" />
          Proposals
        </Link>
      </Button>

      <PageHeader title={p.title} description={p.reference}>
        <ProductStatusControl id={p.id} status={p.status} />
        <ProposalShareControl productId={p.id} shareToken={p.shareToken} />
        {p.status === "accepted" && (
          <ConvertToBookingButton productId={p.id} />
        )}
        <Button asChild variant="outline" size="sm">
          <Link href={`/products/${p.id}/edit`}>
            <Pencil className="mr-2 size-4" />
            Edit
          </Link>
        </Button>
        <DeleteProductButton id={p.id} label={`${p.reference} · ${p.title}`} />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={meta?.label ?? p.status} tone={meta?.badgeClass} />
        {p.client && (
          <Link
            href={`/clients/${p.client.id}`}
            className="text-muted-foreground text-sm hover:underline"
          >
            {p.client.name}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Items</CardTitle>
            </CardHeader>
            <CardContent>
              <ItemsManager
                productId={p.id}
                currency={p.currency}
                suppliers={suppliers}
                items={p.items.map((i) => ({
                  id: i.id,
                  type: i.type,
                  title: i.title,
                  description: i.description,
                  supplier: i.supplier,
                  quantity: i.quantity,
                  unitCost: i.unitCost,
                  unitPrice: i.unitPrice,
                  currency: i.currency,
                }))}
              />
            </CardContent>
          </Card>

          {p.summary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Proposal summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{p.summary}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Net cost" value={formatMoney(totalCost, p.currency)} />
              <Row label={`Margin (${p.markupPercent}%)`} value={formatMoney(margin, p.currency)} />
              <div className="flex items-center justify-between border-t pt-3">
                <span className="font-semibold">Client price</span>
                <span className="text-lg font-bold">
                  {formatMoney(totalPrice, p.currency)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trip details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail icon={MapPin} label="Destination" value={p.destination ?? "—"} />
              <Detail icon={Users} label="Travellers" value={String(p.paxCount)} />
              <Detail
                icon={Calendar}
                label="Dates"
                value={
                  p.startDate || p.endDate
                    ? `${formatDate(p.startDate)} → ${formatDate(p.endDate)}`
                    : "—"
                }
              />
              <Detail
                icon={CalendarClock}
                label="Valid until"
                value={formatDate(p.validUntil)}
              />
              {p.opportunity && (
                <div className="border-t pt-3">
                  <Link
                    href={`/opportunities/${p.opportunity.id}`}
                    className="text-sm hover:underline"
                  >
                    Linked opportunity: {p.opportunity.title}
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p>{value}</p>
      </div>
    </div>
  );
}
