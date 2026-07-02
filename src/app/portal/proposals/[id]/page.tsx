import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { CheckCircle2, XCircle } from "lucide-react";
import { ProposalSignForm } from "@/components/portal/proposal-sign-form";
import { ProposalDocument } from "@/components/products/proposal-document";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { depositAmount, effectiveDepositPercent } from "@/lib/payments/deposit";
import { requirePortalSession } from "@/lib/portal-session";
import { toProposalDocData } from "@/lib/proposal-doc";
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
      agency: { columns: { depositPercent: true } },
      items: { orderBy: (items, { asc: a }) => [a(items.sortOrder)] },
    },
  });

  if (!p) notFound();

  const totalPrice = parseFloat(p.totalPrice || "0");
  // Deposit % resolves along the override chain: this proposal's per-deal
  // override falls back to the agency default (both from the loaded row).
  const depositPercent = effectiveDepositPercent(
    p.depositPercent,
    p.agency?.depositPercent
  );
  const deposit = depositAmount(totalPrice, depositPercent);
  const doc = toProposalDocData(p, session.client.name);

  // Signing is only offered while the proposal is open (not accepted/declined/expired).
  const expired = isExpired(p.validUntil);
  const canSign =
    (p.status === "draft" || p.status === "sent") &&
    !p.acceptedAt &&
    !p.declinedAt &&
    !expired;

  const statusBanner =
    p.status === "accepted" || p.status === "rejected" ? (
      <div className="p-4 pb-0 sm:p-6 sm:pb-0">
        {p.status === "accepted" && (
          <div className="bg-success-soft text-success border-success/30 flex items-center gap-2 rounded-lg border p-4 text-sm">
            <CheckCircle2 className="size-5 shrink-0" />
            <span>
              Accepted{p.signerName ? ` by ${p.signerName}` : ""}
              {p.acceptedAt ? ` on ${formatDate(p.acceptedAt)}` : ""}.
            </span>
          </div>
        )}
        {p.status === "rejected" && (
          <div className="text-muted-foreground bg-muted flex items-center gap-2 rounded-lg border p-4 text-sm">
            <XCircle className="size-5 shrink-0" />
            <span>
              This proposal was declined
              {p.declinedAt ? ` on ${formatDate(p.declinedAt)}` : ""}.
            </span>
          </div>
        )}
      </div>
    ) : null;

  const signSlot = canSign ? (
    <ProposalSignForm
      productId={p.id}
      depositPercent={depositPercent}
      depositLabel={deposit > 0 ? formatMoney(deposit, p.currency) : null}
    />
  ) : null;

  return (
    <div className="space-y-4">
      <Link
        href="/portal/proposals"
        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
      >
        ← Back to my proposals
      </Link>

      <ProposalDocument
        data={doc}
        appName={APP_NAME}
        appTagline={APP_TAGLINE}
        depositPercent={depositPercent}
        statusBanner={statusBanner}
        signSlot={signSlot}
      />
    </div>
  );
}
