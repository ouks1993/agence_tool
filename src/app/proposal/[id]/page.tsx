import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { Compass } from "lucide-react";
import { PrintButton } from "@/components/products/print-button";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { db } from "@/lib/db";
import { PRODUCT_ITEM_TYPE_META, type ProductItemType } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { requireAgencyUser } from "@/lib/permissions";
import { product } from "@/lib/schema";

export const metadata = { title: "Proposal" };

export default async function ProposalView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Auth-protected: only signed-in agents preview the client-facing proposal,
  // and only for proposals belonging to their own agency.
  const user = await requireAgencyUser();
  const { id } = await params;

  const p = await db.query.product.findFirst({
    where: and(eq(product.id, id), eq(product.agencyId, user.agencyId)),
    with: {
      client: { columns: { name: true, email: true } },
      items: { orderBy: (t) => [asc(t.sortOrder)] },
    },
  });
  if (!p) notFound();

  const totalPrice = parseFloat(p.totalPrice || "0");

  return (
    <div className="bg-muted/30 min-h-screen py-8 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-4 flex justify-end">
          <PrintButton />
        </div>

        <div className="bg-card rounded-lg border p-8 shadow-sm print:border-0 print:shadow-none">
          {/* Header */}
          <div className="flex items-start justify-between border-b pb-6">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 flex size-11 items-center justify-center rounded-lg">
                <Compass className="text-primary size-6" />
              </div>
              <div>
                <p className="text-xl font-bold">{APP_NAME}</p>
                <p className="text-muted-foreground text-sm">{APP_TAGLINE}</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="text-muted-foreground font-mono text-xs">{p.reference}</p>
              <p className="text-muted-foreground">{formatDate(p.createdAt)}</p>
            </div>
          </div>

          {/* Title */}
          <div className="py-6">
            <h1 className="text-2xl font-bold">{p.title}</h1>
            <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {p.client?.name && <span>Prepared for {p.client.name}</span>}
              {p.destination && <span>· {p.destination}</span>}
              {(p.startDate || p.endDate) && (
                <span>
                  · {formatDate(p.startDate)} → {formatDate(p.endDate)}
                </span>
              )}
              <span>· {p.paxCount} traveller{p.paxCount === 1 ? "" : "s"}</span>
            </div>
          </div>

          {/* Summary */}
          {p.summary && (
            <p className="border-y py-5 text-sm leading-7 whitespace-pre-wrap">
              {p.summary}
            </p>
          )}

          {/* Items */}
          <div className="py-6">
            <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">
              What&apos;s included
            </h2>
            {p.items.length === 0 ? (
              <p className="text-muted-foreground text-sm">No items yet.</p>
            ) : (
              <ul className="divide-y">
                {p.items.map((item) => {
                  const linePrice = parseFloat(item.unitPrice || "0") * item.quantity;
                  return (
                    <li key={item.id} className="flex items-start justify-between gap-4 py-3">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-muted-foreground text-xs">
                          {PRODUCT_ITEM_TYPE_META[item.type as ProductItemType]?.label ??
                            item.type}
                          {item.description ? ` · ${item.description}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 font-medium">
                        {formatMoney(linePrice, item.currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between border-t pt-5">
            <span className="text-lg font-semibold">Total</span>
            <span className="text-2xl font-bold">
              {formatMoney(totalPrice, p.currency)}
            </span>
          </div>

          {/* Footer */}
          <div className="text-muted-foreground mt-8 border-t pt-5 text-xs">
            {p.validUntil && <p>This proposal is valid until {formatDate(p.validUntil)}.</p>}
            <p className="mt-1">
              Prepared by {APP_NAME} · {APP_TAGLINE}. Prices are per the package and
              subject to availability at the time of booking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
