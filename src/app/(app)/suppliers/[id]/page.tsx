import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import {
  Pencil,
  Plus,
  Mail,
  Phone,
  Globe,
  MapPin,
  User,
  Briefcase,
  FileText,
  Wallet,
  BedDouble,
  Plane,
  Car,
  Bus,
  ShieldCheck,
  Package,
  ChevronLeft,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { ClientAvatar } from "@/components/clients/client-avatar";
import { ContractDialog } from "@/components/suppliers/contract-dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupplierById } from "@/lib/actions/suppliers";
import {
  headlineTotal,
  num,
  otherCurrencies,
  sumByCurrency,
} from "@/lib/analytics";
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
import { formatDate, formatMoney, formatMoneyCompact } from "@/lib/format";
import { requireAgencyUser } from "@/lib/permissions";
import { bookingItem } from "@/lib/schema";
import { statusTone } from "@/lib/status-tone";
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
  const t = await getTranslations("suppliers");
  const { id } = await params;

  const s = await getSupplierById(id);
  if (!s) notFound();

  // Booking items referencing this supplier — drive the derived stat strip.
  // amount/currency are real columns; volume is summed per currency (never mixed).
  const items = await db
    .select({
      amount: bookingItem.amount,
      quantity: bookingItem.quantity,
      currency: bookingItem.currency,
    })
    .from(bookingItem)
    .where(eq(bookingItem.supplierId, id));

  const bookingCount = items.length;
  const volumeByCurrency = sumByCurrency(
    items,
    (i) => num(i.amount) * (i.quantity ?? 1),
    (i) => i.currency
  );
  const headlineVolume = headlineTotal(volumeByCurrency);
  const strayVolume = otherCurrencies(volumeByCurrency);

  const contractCount = s.contracts.length;
  const activeContracts = s.contracts.filter(
    (c) => c.status === "active"
  ).length;

  const typeMeta = SUPPLIER_TYPE_META[s.type as SupplierType];
  const statusMeta = SUPPLIER_STATUS_META[s.status as SupplierStatus];
  const TypeIcon = TYPE_ICONS[s.type as SupplierType] ?? Package;

  const location = [s.city, s.country].filter(Boolean).join(", ");
  const hasContact = s.contactName || s.email || s.phone || s.website;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      {/* Breadcrumb + header actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/suppliers">{t("title")}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{typeMeta?.label ?? s.type}</BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{s.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Button asChild variant="outline" size="sm">
          <Link href={`/suppliers/${s.id}/edit`}>
            <Pencil className="mr-1.5 size-4" />
            {t("editSupplier")}
          </Link>
        </Button>
      </div>

      {/* Profile header — avatar, name, type/status badges, location. */}
      <Card className="card-elevated overflow-hidden">
        <div className="flex flex-col gap-4 border-b px-6 py-5 sm:flex-row sm:items-center">
          <ClientAvatar name={s.name} className="size-14 text-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {s.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={typeMeta?.label ?? s.type}
                variant="neutral"
                className="gap-1.5"
              />
              <StatusBadge
                label={statusMeta?.label ?? s.status}
                variant={statusTone("supplier", s.status)}
              />
              {location && (
                <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
                  <MapPin className="size-3.5" />
                  {location}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Derived stat strip — real data only, currency-safe. */}
        <dl className="grid grid-cols-2 sm:grid-cols-3">
          <div className="border-r border-b p-4 sm:border-b-0">
            <dd className="text-lg font-bold tracking-tight tabular-nums">
              {bookingCount}
            </dd>
            <dt className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
              <Briefcase className="size-3.5" />
              {t("profile.bookings")}
            </dt>
          </div>
          <div className="border-b p-4 sm:border-r sm:border-b-0">
            <dd className="text-lg font-bold tracking-tight tabular-nums">
              {formatMoneyCompact(headlineVolume, "DZD")}
              {strayVolume.length > 0 && (
                <span className="text-muted-foreground ml-1 text-xs font-medium">
                  {t("profile.otherCurrencies", {
                    list: strayVolume
                      .map((c) => formatMoneyCompact(c.value, c.currency))
                      .join(" · "),
                  })}
                </span>
              )}
            </dd>
            <dt className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
              <Wallet className="size-3.5" />
              {t("profile.bookedVolume")}
            </dt>
          </div>
          <div className="col-span-2 p-4 sm:col-span-1">
            <dd className="text-lg font-bold tracking-tight tabular-nums">
              {contractCount}
              {activeContracts > 0 && (
                <span className="text-muted-foreground ml-1.5 text-xs font-medium">
                  {t("profile.activeContracts", { count: activeContracts })}
                </span>
              )}
            </dd>
            <dt className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
              <FileText className="size-3.5" />
              {t("profile.contracts")}
            </dt>
          </div>
        </dl>
      </Card>

      {/* Details */}
      {(hasContact || location || s.notes) && (
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TypeIcon className="text-muted-foreground size-4" />
              {t("profile.details")}
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
                <a href={`tel:${s.phone}`} className="hover:underline">
                  {s.phone}
                </a>
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
            {(location || s.address) && (
              <p className="flex items-start gap-2">
                <MapPin className="text-muted-foreground mt-0.5 size-4" />
                <span>
                  {[s.address, s.city, s.country].filter(Boolean).join(", ")}
                </span>
              </p>
            )}
            {s.notes && (
              <p className="text-muted-foreground border-t pt-3 whitespace-pre-wrap">
                {s.notes}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contracts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("profile.contractsHeading")}</h2>
          <ContractDialog
            supplierId={s.id}
            trigger={
              <Button size="sm" variant="outline">
                <Plus className="mr-1 size-4" />
                {t("profile.addContract")}
              </Button>
            }
          />
        </div>

        {s.contracts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t("profile.noContracts")}
            description={t("profile.noContractsDesc")}
            action={
              <ContractDialog
                supplierId={s.id}
                trigger={
                  <Button size="sm">
                    <Plus className="mr-1 size-4" />
                    {t("profile.addContract")}
                  </Button>
                }
              />
            }
          />
        ) : (
          <div className="space-y-4">
            {s.contracts.map((contract) => {
              const contractStatus =
                CONTRACT_STATUS_META[contract.status as ContractStatus];
              return (
                <Card key={contract.id} className="card-elevated">
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
                      variant={statusTone("contract", contract.status)}
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
                                    className={cn(
                                      "text-foreground font-medium tabular-nums"
                                    )}
                                  >
                                    {formatMoney(rate.netRate, rate.currency)}
                                  </span>
                                </span>
                              )}
                              {rate.sellRate != null && (
                                <span>
                                  Sell:{" "}
                                  <span className="text-foreground font-medium tabular-nums">
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

      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/suppliers">
          <ChevronLeft className="mr-1 size-4" />
          {t("profile.backToSuppliers")}
        </Link>
      </Button>
    </div>
  );
}
