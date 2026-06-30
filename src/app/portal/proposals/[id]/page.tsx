import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { CheckCircle2, PackageOpen, XCircle } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { ProposalSignForm } from "@/components/portal/proposal-sign-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import {
  PRODUCT_ITEM_TYPE_META,
  PRODUCT_STATUS_META,
  type ProductItemType,
  type ProductStatus,
} from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { requirePortalSession } from "@/lib/portal-session";
import { product } from "@/lib/schema";

/** True when the proposal's validity date has passed. */
function isExpired(validUntil: Date | null): boolean {
  if (!validUntil) return false;
  return validUntil.getTime() < Date.now();
}

export default async function PortalProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requirePortalSession();

  // Strict ownership: id + clientId + agencyId must all match.
  const p = await db.query.product.findFirst({
    where: and(
      eq(product.id, id),
      eq(product.clientId, session.client.id),
      eq(product.agencyId, session.client.agencyId)
    ),
    with: {
      items: { orderBy: (items, { asc }) => [asc(items.sortOrder)] },
    },
  });

  if (!p) notFound();

  const statusMeta = PRODUCT_STATUS_META[p.status as ProductStatus];
  const totalPrice = parseFloat(p.totalPrice || "0");

  // Signing is only offered while the proposal is open (not accepted/declined/expired).
  const expired = isExpired(p.validUntil);
  const canSign =
    (p.status === "draft" || p.status === "sent") &&
    !p.acceptedAt &&
    !p.declinedAt &&
    !expired;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/portal/proposals"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to my proposals
          </Link>
          <h1 className="text-2xl font-bold mt-1">{p.title}</h1>
          <p className="text-muted-foreground text-sm">
            {p.reference}
            {p.validUntil ? ` · Valid until ${formatDate(p.validUntil)}` : ""}
          </p>
        </div>
        {statusMeta ? (
          <Badge variant="secondary" className={statusMeta.badgeClass}>
            {statusMeta.label}
          </Badge>
        ) : (
          <Badge variant="secondary">{p.status}</Badge>
        )}
      </div>

      {/* Acceptance / decline banners */}
      {p.status === "accepted" && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="size-5 shrink-0" />
          <span>
            Accepted{p.signerName ? ` by ${p.signerName}` : ""}
            {p.acceptedAt ? ` on ${formatDate(p.acceptedAt)}` : ""}.
          </span>
        </div>
      )}
      {p.status === "rejected" && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted p-4 text-sm text-muted-foreground">
          <XCircle className="size-5 shrink-0" />
          <span>
            This proposal was declined
            {p.declinedAt ? ` on ${formatDate(p.declinedAt)}` : ""}.
          </span>
        </div>
      )}

      {/* Line items */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle>What&apos;s included</CardTitle>
        </CardHeader>
        <CardContent>
          {p.items.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title="No items yet"
              description="This proposal doesn't include any line items at the moment."
            />
          ) : (
            <>
              <div className="divide-y">
                {p.items.map((item) => {
                  const typeMeta =
                    PRODUCT_ITEM_TYPE_META[item.type as ProductItemType];
                  const meta: string[] = [typeMeta?.label ?? item.type];
                  if (item.supplier) meta.push(item.supplier);
                  return (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-4 py-4 first:pt-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {meta.join(" · ")}
                          {item.quantity > 1 ? ` · ×${item.quantity}` : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-right font-semibold tabular-nums">
                        {formatMoney(
                          parseFloat(item.unitPrice || "0") * item.quantity,
                          item.currency
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-xl font-bold tabular-nums">
                  {formatMoney(totalPrice, p.currency)}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Accept & sign */}
      {canSign && (
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <ProposalSignForm productId={p.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
