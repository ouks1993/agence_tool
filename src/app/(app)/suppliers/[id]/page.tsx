import Link from "next/link";
import { notFound } from "next/navigation";
import { count, eq } from "drizzle-orm";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Mail,
  Phone,
  Globe,
  MapPin,
  User,
  Briefcase,
  FileText,
  BedDouble,
  Plane,
  Car,
  Bus,
  ShieldCheck,
  Package,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { ContractDialog } from "@/components/suppliers/contract-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupplierById } from "@/lib/actions/suppliers";
import { db } from "@/lib/db";
import {
  CONTRACT_BASIS_LABEL,
  CONTRACT_STATUS_META,
  SUPPLIER_STATUS_META,
  SUPPLIER_TYPE_META,
  type ContractBasis,
  type ContractStatus,
  type SupplierStatus,
  type SupplierType,
} from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { requireAgencyUser } from "@/lib/permissions";
import { bookingItem } from "@/lib/schema";
import { cn } from "@/lib/utils";

/** Map the icon names stored in SUPPLIER_TYPE_META to Lucide components. */
const TYPE_ICONS: Record<SupplierType, React.ComponentType<{ className?: string }>> = {
  hotel: BedDouble,
  airline: Plane,
  car_rental: Car,
  transfer: Bus,
  dmc: Globe,
  insurance: ShieldCheck,
  other: Package,
};

/** Renders a contract's commission term, e.g. "15% commission" or "Net rate". */
function commissionLabel(
  basis: ContractBasis | null,
  rate: string | null,
  currency: string
): string {
  if (!basis) return "No commission terms";
  if (basis === "net") return CONTRACT_BASIS_LABEL.net;
  if (rate == null) return CONTRACT_BASIS_LABEL[basis];
  return basis === "percent"
    ? `${rate}% commission`
    : `${formatMoney(rate, currency)} commission`;
}

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAgencyUser();
  const { id } = await params;

  const s = await getSupplierById(id);
  if (!s) notFound();

  // Count how many booking items reference this supplier (one focused query).
  const [bookingRow] = await db
    .select({ value: count(bookingItem.id) })
    .from(bookingItem)
    .where(eq(bookingItem.supplierId, id));
  const bookingCount = bookingRow?.value ?? 0;

  const typeMeta = SUPPLIER_TYPE_META[s.type as SupplierType];
  const statusMeta = SUPPLIER_STATUS_META[s.status as SupplierStatus];
  const TypeIcon = TYPE_ICONS[s.type as SupplierType] ?? Package;

  const hasLocation = s.city || s.country;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/suppliers">
          <ArrowLeft className="mr-1 size-4" />
          Suppliers
        </Link>
      </Button>

      <PageHeader title={s.name}>
        <Button asChild variant="outline" size="sm">
          <Link href={`/suppliers/${s.id}/edit`}>
            <Pencil className="mr-2 size-4" />
            Edit
          </Link>
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          label={typeMeta?.label ?? s.type}
          className="gap-1 bg-secondary text-secondary-foreground"
        />
        <StatusBadge
          label={statusMeta?.label ?? s.status}
          tone={statusMeta?.className}
        />
      </div>

      {/* Supplier info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TypeIcon className="text-muted-foreground size-4" />
            Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {s.contactName && (
            <p className="flex items-center gap-2">
              <User className="text-muted-foreground size-4" />
              {s.contactName}
            </p>
          )}
          {s.email && (
            <p className="flex items-center gap-2">
              <Mail className="text-muted-foreground size-4" />
              <a href={`mailto:${s.email}`} className="hover:underline">
                {s.email}
              </a>
            </p>
          )}
          {s.phone && (
            <p className="flex items-center gap-2">
              <Phone className="text-muted-foreground size-4" />
              {s.phone}
            </p>
          )}
          {s.website && (
            <p className="flex items-center gap-2">
              <Globe className="text-muted-foreground size-4" />
              <a
                href={s.website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {s.website}
              </a>
            </p>
          )}
          {hasLocation && (
            <p className="flex items-start gap-2">
              <MapPin className="text-muted-foreground mt-0.5 size-4" />
              <span>{[s.city, s.country].filter(Boolean).join(", ")}</span>
            </p>
          )}
          <p className="flex items-center gap-2">
            <Briefcase className="text-muted-foreground size-4" />
            <span>
              Used in {bookingCount} booking{bookingCount === 1 ? "" : "s"}
            </span>
          </p>
          {s.notes && (
            <p className="text-muted-foreground border-t pt-3 whitespace-pre-wrap">
              {s.notes}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Contracts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Contracts</h2>
          <ContractDialog
            supplierId={s.id}
            trigger={
              <Button size="sm" variant="outline">
                <Plus className="mr-1 size-4" />
                Add contract
              </Button>
            }
          />
        </div>

        {s.contracts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <FileText className="text-muted-foreground size-8" />
              <p className="text-muted-foreground text-sm">
                No contracts yet. Add one to record commission terms and rates.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {s.contracts.map((contract) => {
              const contractStatus =
                CONTRACT_STATUS_META[contract.status as ContractStatus];
              return (
                <Card key={contract.id}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-3">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="text-base">{contract.name}</CardTitle>
                      <p className="text-muted-foreground text-sm">
                        {commissionLabel(
                          contract.commissionBasis as ContractBasis | null,
                          contract.commissionRate,
                          contract.currency
                        )}
                        {(contract.validFrom || contract.validTo) && (
                          <span>
                            {" · "}
                            {formatDate(contract.validFrom)} –{" "}
                            {formatDate(contract.validTo)}
                          </span>
                        )}
                      </p>
                    </div>
                    <StatusBadge
                      label={contractStatus?.label ?? contract.status}
                      tone={contractStatus?.className}
                    />
                  </CardHeader>
                  {contract.rates.length > 0 && (
                    <CardContent>
                      <ul className="divide-y rounded-md border">
                        {contract.rates.map((rate) => (
                          <li
                            key={rate.id}
                            className="flex items-center justify-between gap-3 p-3 text-sm"
                          >
                            <span className="min-w-0 truncate">
                              {rate.description}
                            </span>
                            <span className="text-muted-foreground flex shrink-0 items-center gap-4">
                              {rate.netRate != null && (
                                <span>
                                  Net:{" "}
                                  <span
                                    className={cn("text-foreground font-medium")}
                                  >
                                    {formatMoney(rate.netRate, rate.currency)}
                                  </span>
                                </span>
                              )}
                              {rate.sellRate != null && (
                                <span>
                                  Sell:{" "}
                                  <span className="text-foreground font-medium">
                                    {formatMoney(rate.sellRate, rate.currency)}
                                  </span>
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
