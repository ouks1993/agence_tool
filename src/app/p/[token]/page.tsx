import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { CheckCircle2, Download, XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  ProposalDocument,
  type ProposalDocLabels,
} from "@/components/products/proposal-document";
import { ProposalSignForm } from "@/components/products/proposal-sign-form";
import { Button } from "@/components/ui/button";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { db } from "@/lib/db";
import { formatDate, formatMoney } from "@/lib/format";
import { depositAmount } from "@/lib/payments/deposit";
import { toProposalDocData } from "@/lib/proposal-doc";
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
      agency: { columns: { depositPercent: true } },
      items: { orderBy: (t) => [asc(t.sortOrder)] },
    },
  });
  if (!p) notFound();

  const totalPrice = parseFloat(p.totalPrice || "0");
  // Deposit that "secures the dates" is the proposal's agency deposit %, derived
  // from the loaded product row (tenant-safe — never a caller-supplied value).
  const depositPercent = parseFloat(p.agency?.depositPercent ?? "50");
  const deposit = depositAmount(totalPrice, depositPercent);
  const expired = isExpired(p.validUntil);
  const open = !p.acceptedAt && !p.declinedAt && !expired;
  const doc = toProposalDocData(p, p.client?.name ?? null);

  const docLabels: ProposalDocLabels = {
    eyebrow: t("document.eyebrow"),
    travellers: (count) => t("document.travellers", { count }),
    greeting: (name) => t("document.greeting", { name }),
    dayByDay: t("document.dayByDay"),
    whatsIncluded: t("document.whatsIncluded"),
    fullItinerary: t("document.fullItinerary"),
    totalPackage: t("document.totalPackage"),
    taxesAndDeposit: (deposit) => t("document.taxesAndDeposit", { deposit }),
    taxesNoDeposit: t("document.taxesNoDeposit"),
    validUntil: (date) => t("document.validUntil", { date }),
    preparedBy: (appName, tagline) =>
      t("document.preparedBy", { appName, tagline }),
  };

  const statusBanner =
    p.acceptedAt || p.declinedAt || expired ? (
      <div className="p-4 pb-0 sm:p-6 sm:pb-0">
        {p.acceptedAt && (
          <div className="bg-success-soft text-success border-success/30 flex items-center gap-2 rounded-lg border p-4 text-sm">
            <CheckCircle2 className="size-5 shrink-0" />
            <span>
              Accepted{p.signerName ? ` by ${p.signerName}` : ""} on{" "}
              {formatDate(p.acceptedAt)}.
            </span>
          </div>
        )}
        {p.declinedAt && (
          <div className="bg-destructive/10 text-destructive border-destructive/30 flex items-center gap-2 rounded-lg border p-4 text-sm">
            <XCircle className="size-5 shrink-0" />
            <span>This proposal was declined on {formatDate(p.declinedAt)}.</span>
          </div>
        )}
        {expired && !p.acceptedAt && !p.declinedAt && (
          <div className="bg-warning-soft text-warning border-warning/30 rounded-lg border p-4 text-sm">
            This proposal expired on {formatDate(p.validUntil)}. Please ask for an
            updated one.
          </div>
        )}
      </div>
    ) : null;

  const signSlot = open ? (
    <ProposalSignForm
      token={token}
      defaultEmail={p.client?.email ?? null}
      depositPercent={depositPercent}
      depositLabel={deposit > 0 ? formatMoney(deposit, p.currency) : null}
    />
  ) : null;

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

        <ProposalDocument
          data={doc}
          appName={APP_NAME}
          appTagline={APP_TAGLINE}
          labels={docLabels}
          depositPercent={depositPercent}
          statusBanner={statusBanner}
          signSlot={signSlot}
        />
      </div>
    </div>
  );
}
