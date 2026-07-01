import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { Plus, FileText } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import {
  PRODUCT_STATUS_META,
  seesAllData,
  type ProductStatus,
} from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { requireAgencyUser } from "@/lib/permissions";
import { product } from "@/lib/schema";

export const metadata = { title: "Proposals" };

export default async function ProductsPage() {
  const user = await requireAgencyUser();

  const products = await db.query.product.findMany({
    // Agents see only proposals they created (others see all).
    where: and(
      eq(product.agencyId, user.agencyId),
      seesAllData(user.role) ? undefined : eq(product.createdById, user.id)
    ),
    with: { client: { columns: { name: true } } },
    orderBy: [desc(product.createdAt)],
    limit: 200,
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Proposals"
        description="Travel packages and quotes assembled for your clients."
      >
        <Button asChild>
          <Link href="/proposals/new">
            <Plus className="mr-2 size-4" />
            New proposal
          </Link>
        </Button>
      </PageHeader>

      {products.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No proposals yet"
          description="Build a proposal from search results, or start one from scratch."
          action={
            <Button asChild>
              <Link href="/proposals/new">
                <Plus className="mr-2 size-4" />
                New proposal
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric>Total</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => {
                const meta = PRODUCT_STATUS_META[p.status as ProductStatus];
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      <Link href={`/proposals/${p.id}`} className="hover:underline">
                        {p.reference}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/proposals/${p.id}`} className="font-medium hover:underline">
                        {p.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.client?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge label={meta?.label ?? p.status} tone={meta?.badgeClass} />
                    </TableCell>
                    <TableCell numeric className="font-medium">
                      {formatMoney(p.totalPrice, p.currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(p.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
