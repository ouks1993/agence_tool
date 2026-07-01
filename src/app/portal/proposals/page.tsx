import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { ArrowRight, FileSignature, FileText, MapPin } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { StatusPill } from "@/components/app/status-badge";
import { SectionHead } from "@/components/portal/portal-bits";
import { db } from "@/lib/db";
import { PRODUCT_STATUS_META, type ProductStatus } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { requirePortalSession } from "@/lib/portal-session";
import { product } from "@/lib/schema";

/** True while an open proposal is still awaiting the client's signature. */
function awaitsSignature(status: ProductStatus, validUntil: Date | null) {
  const open = status === "draft" || status === "sent";
  const live = !validUntil || new Date(validUntil).getTime() > Date.now();
  return open && live;
}

export default async function PortalProposalsPage() {
  const session = await requirePortalSession();

  // Scope strictly to this client AND their agency (defence in depth).
  const proposals = await db.query.product.findMany({
    where: and(
      eq(product.clientId, session.client.id),
      eq(product.agencyId, session.client.agencyId)
    ),
    columns: {
      id: true,
      reference: true,
      title: true,
      status: true,
      totalPrice: true,
      currency: true,
      validUntil: true,
      destination: true,
    },
    orderBy: [desc(product.createdAt)],
  });

  const pendingCount = proposals.filter((p) =>
    awaitsSignature(p.status as ProductStatus, p.validUntil)
  ).length;

  return (
    <div className="space-y-7">
      {/* Welcome — same rhythm as the portal home */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          My proposals
        </h1>
        <p className="text-muted-foreground">
          {pendingCount > 0
            ? `You have ${pendingCount} proposal${pendingCount === 1 ? "" : "s"} awaiting your signature.`
            : `Every quote we've prepared for you, ${session.client.name.split(/\s+/)[0]}.`}
        </p>
      </div>

      <section>
        <SectionHead
          title="Proposals"
          hint={`${proposals.length} ${proposals.length === 1 ? "proposal" : "proposals"}`}
        />

        {proposals.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No proposals yet"
            description="When your travel agency sends you a proposal, it will appear here for you to review, accept, and pay."
          />
        ) : (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {proposals.map((p) => {
              const meta = PRODUCT_STATUS_META[p.status as ProductStatus];
              const pending = awaitsSignature(
                p.status as ProductStatus,
                p.validUntil
              );
              return (
                <Link
                  key={p.id}
                  href={`/portal/proposals/${p.id}`}
                  className="group card-elevated focus-visible:ring-ring flex flex-col rounded-lg border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:outline-none"
                >
                  {/* Eyebrow: status dot pill + booking reference */}
                  <div className="flex items-center justify-between gap-2">
                    <StatusPill
                      domain="product"
                      status={p.status}
                      label={meta?.label ?? p.status}
                      dot
                    />
                    <span className="text-muted-foreground/70 font-mono text-xs">
                      {p.reference}
                    </span>
                  </div>

                  {/* Title */}
                  <div className="mt-3 text-base font-semibold tracking-tight">
                    {p.title}
                  </div>

                  {/* Destination + validity */}
                  <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    {p.destination && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3.5" />
                        {p.destination}
                      </span>
                    )}
                    {p.validUntil && (
                      <span>Valid until {formatDate(p.validUntil)}</span>
                    )}
                  </div>

                  {/* Price footer + CTA */}
                  <div className="mt-4 flex items-end justify-between gap-3 border-t pt-3.5">
                    <div>
                      <div className="text-lg font-bold tracking-tight tabular-nums">
                        {formatMoney(p.totalPrice, p.currency)}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {pending ? "Awaiting your signature" : "All taxes included"}
                      </div>
                    </div>
                    <span className="text-primary inline-flex items-center gap-1.5 text-sm font-medium group-hover:underline">
                      {pending ? (
                        <>
                          <FileSignature className="size-4" />
                          Review &amp; sign
                        </>
                      ) : (
                        <>
                          View
                          <ArrowRight className="size-3.5" />
                        </>
                      )}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
