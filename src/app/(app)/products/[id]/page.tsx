import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import {
  ArrowLeft,
  CalendarClock,
  Calendar,
  Eye,
  MapPin,
  Pencil,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-badge";
import { ConvertToBookingButton } from "@/components/products/convert-to-booking-button";
import { DeleteProductButton } from "@/components/products/delete-product-button";
import { ItemsManager } from "@/components/products/items-manager";
import { ProductStatusControl } from "@/components/products/product-status-control";
import { ProposalDocument } from "@/components/products/proposal-document";
import { ProposalShareControl } from "@/components/products/proposal-share-control";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSuppliersForPicker } from "@/lib/actions/suppliers";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { db } from "@/lib/db";
import {
  PRODUCT_STATUS_META,
  seesAllData,
  type ProductStatus,
} from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { effectiveDepositPercent } from "@/lib/payments/deposit";
import { requireAgencyUser } from "@/lib/permissions";
import { toProposalDocData } from "@/lib/proposal-doc";
import { product } from "@/lib/schema";
import { cn } from "@/lib/utils";

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
        client: { columns: { id: true, name: true, email: true, city: true } },
        opportunity: { columns: { id: true, title: true } },
        agency: { columns: { depositPercent: true } },
        items: { orderBy: (t) => [asc(t.sortOrder)] },
      },
    }),
    getSuppliersForPicker(),
  ]);
  if (!p) notFound();

  const meta = PRODUCT_STATUS_META[p.status as ProductStatus];
  const doc = toProposalDocData(p, p.client?.name ?? null);
  // Preview mirrors the client-facing deposit: per-deal override → agency default.
  const depositPercent = effectiveDepositPercent(
    p.depositPercent,
    p.agency?.depositPercent
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/proposals">
          <ArrowLeft className="mr-1 size-4" />
          Proposals
        </Link>
      </Button>

      <PageHeader title={p.title} description={p.reference}>
        <ProductStatusControl id={p.id} status={p.status} />
        <ProposalShareControl productId={p.id} shareToken={p.shareToken} />
        {p.status === "accepted" && <ConvertToBookingButton productId={p.id} />}
        <Button asChild variant="outline" size="sm">
          <Link href={`/proposal/${p.id}`} target="_blank">
            <Eye className="mr-2 size-4" />
            Preview
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/proposals/${p.id}/edit`}>
            <Pencil className="mr-2 size-4" />
            Edit
          </Link>
        </Button>
        <DeleteProductButton id={p.id} label={`${p.reference} · ${p.title}`} />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <StatusPill domain="product" status={p.status} label={meta?.label ?? p.status} />
        {p.client && (
          <Link
            href={`/clients/${p.client.id}`}
            className="text-muted-foreground text-sm hover:underline"
          >
            {p.client.name}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_460px]">
        {/* Editing column */}
        <div className="min-w-0 space-y-6">
          {/* Client card */}
          <Card className="card-elevated">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="bg-brand/10 text-brand flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                {(p.client?.name ?? "—").trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {p.client?.name ?? "No client assigned"}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {[p.client?.city, p.client?.email]
                    .filter(Boolean)
                    .join(" · ") || "Assign a client to personalise the proposal"}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/proposals/${p.id}/edit`}>Change</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Trip details strip */}
          <Card className="card-elevated">
            <div className="grid grid-cols-2 divide-x divide-y md:grid-cols-4 md:divide-y-0">
              <TripCell icon={MapPin} label="Destination" value={p.destination ?? "—"} />
              <TripCell
                icon={Calendar}
                label="Dates"
                value={
                  p.startDate || p.endDate
                    ? `${formatDate(p.startDate)} → ${formatDate(p.endDate)}`
                    : "—"
                }
              />
              <TripCell icon={Users} label="Travellers" value={String(p.paxCount)} />
              <TripCell
                icon={CalendarClock}
                label="Valid until"
                value={formatDate(p.validUntil)}
              />
            </div>
          </Card>

          {/* Line items */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="text-base">Line items</CardTitle>
            </CardHeader>
            <CardContent>
              <ItemsManager
                productId={p.id}
                currency={p.currency}
                suppliers={suppliers}
                defaultMarginPercent={Number(p.markupPercent) || 0}
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
                  startDate: i.startDate,
                }))}
              />
            </CardContent>
          </Card>

          {p.opportunity && (
            <Card className="card-elevated">
              <CardContent className="py-4">
                <Link
                  href={`/opportunities/${p.opportunity.id}`}
                  className="text-sm hover:underline"
                >
                  Linked opportunity: {p.opportunity.title}
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Live client preview rail */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="mb-2 flex items-center gap-2">
            <Eye className="text-muted-foreground size-4" />
            <p className="text-sm font-semibold">Live client preview</p>
            <span className="text-muted-foreground ml-auto text-xs">
              What your client sees
            </span>
          </div>
          <div className="max-h-[calc(100vh-8rem)] overflow-y-auto rounded-lg">
            <ProposalDocument
              data={doc}
              appName={APP_NAME}
              appTagline={APP_TAGLINE}
              depositPercent={depositPercent}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TripCell({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1 p-4", className)}>
      <p className="text-muted-foreground flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wide uppercase">
        <Icon className="size-3" />
        {label}
      </p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
