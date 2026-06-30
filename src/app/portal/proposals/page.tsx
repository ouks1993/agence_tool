import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { PRODUCT_STATUS_META, type ProductStatus } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { requirePortalSession } from "@/lib/portal-session";
import { product } from "@/lib/schema";

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
    },
    orderBy: [desc(product.createdAt)],
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">My Proposals</h1>
        <p className="text-muted-foreground">
          Welcome back, {session.client.name}
        </p>
      </div>

      {proposals.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No proposals yet"
          description="When your travel agency sends you a proposal, it will appear here for you to review, accept, and pay."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {proposals.map((p) => {
            const meta = PRODUCT_STATUS_META[p.status as ProductStatus];
            return (
              <Link key={p.id} href={`/portal/proposals/${p.id}`}>
                <Card className="card-interactive card-elevated h-full cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{p.title}</CardTitle>
                      {meta ? (
                        <Badge variant="secondary" className={meta.badgeClass}>
                          {meta.label}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{p.status}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {p.reference}
                      {p.validUntil
                        ? ` · Valid until ${formatDate(p.validUntil)}`
                        : ""}
                    </p>
                    <p className="text-sm font-semibold mt-1">
                      {formatMoney(p.totalPrice, p.currency)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
