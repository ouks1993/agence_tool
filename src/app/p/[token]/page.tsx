import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { CheckCircle2, Compass, Download, XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ProposalSignForm } from "@/components/products/proposal-sign-form";
import { Button } from "@/components/ui/button";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { db } from "@/lib/db";
import { PRODUCT_ITEM_TYPE_META, type ProductItemType } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { product } from "@/lib/schema";

export const metadata = { title: "Proposal", robots: { index: false } };

/** True when the proposal's validity date has passed. */
function isExpired(validUntil: Date | null): boolean {
  if (!validUntil) return false;
  return validUntil.getTime() < Date.now();
}

export default async function PublicProposal({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations("public.proposal");

  const p = await db.query.product.findFirst({
    where: eq(product.shareToken, token),
    with: {
      client: { columns: { name: true, email: true } },
      items: { orderBy: (t) => [asc(t.sortOrder)] },
    },
  });
  if (!p) notFound();

  const totalPrice = parseFloat(p.totalPrice || "0");
  const expired = isExpired(p.validUntil);
  const open = !p.acceptedAt && !p.declinedAt && !expired;

  return (
    <div className="bg-muted/30 min-h-screen py-8">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-4 flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link href={`/p/${token}/pdf`} target="_blank">
              <Download className="mr-1 size-4" /> {t("downloadPdf")}
            </Link>
          </Button>
        </div>

        {/* Acceptance / decline status banner */}
        {p.acceptedAt && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-700 dark:text-green-400">
            <CheckCircle2 className="size-5 shrink-0" />
            <span>
              Accepted{p.signerName ? ` by ${p.signerName}` : ""} on{" "}
              {formatDate(p.acceptedAt)}.
            </span>
          </div>
        )}
        {p.declinedAt && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-400">
            <XCircle className="size-5 shrink-0" />
            <span>This proposal was declined on {formatDate(p.declinedAt)}.</span>
          </div>
        )}
        {expired && !p.acceptedAt && !p.declinedAt && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
            This proposal expired on {formatDate(p.validUntil)}. Please ask for an
            updated one.
          </div>
        )}

        <div className="bg-card rounded-lg border p-8 shadow-sm">
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
              <span>
                · {p.paxCount} traveller{p.paxCount === 1 ? "" : "s"}
              </span>
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
              {t("whatsIncluded")}
            </h2>
            {p.items.length === 0 ? (
              <p className="text-muted-foreground text-sm">No items yet.</p>
            ) : (
              <ul className="divide-y">
                {p.items.map((item) => {
                  const linePrice = parseFloat(item.unitPrice || "0") * item.quantity;
                  return (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-4 py-3"
                    >
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-muted-foreground text-xs">
                          {PRODUCT_ITEM_TYPE_META[item.type as ProductItemType]
                            ?.label ?? item.type}
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
            <span className="text-lg font-semibold">{t("total")}</span>
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

          {/* Accept & sign */}
          {open && (
            <div className="mt-8 border-t pt-6">
              <ProposalSignForm token={token} defaultEmail={p.client?.email ?? null} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
