import Link from "next/link";
import {
  Plus,
  Truck,
  BedDouble,
  Plane,
  Car,
  Bus,
  Globe,
  ShieldCheck,
  Package,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ChevronRight,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { ClientAvatar } from "@/components/clients/client-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type SortDirection,
} from "@/components/ui/table";
import { getSuppliers } from "@/lib/actions/suppliers";
import {
  SUPPLIER_STATUS_META,
  SUPPLIER_STATUSES,
  SUPPLIER_TYPE_META,
  SUPPLIER_TYPES,
  type SupplierStatus,
  type SupplierType,
} from "@/lib/domain";
import { requireAgencyUser } from "@/lib/permissions";
import { statusTone } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

export const metadata = { title: "Suppliers" };

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

const STATUS_ORDER: SupplierStatus[] = ["active", "inactive"];

// Sortable columns → the field the loaded rows order by (client-side sort on
// the already-fetched page, so no extra query and the booking count stays in
// range). `bookings` sorts by the derived count.
const SORTABLE = ["name", "type", "status", "location", "bookings"] as const;
type SortKey = (typeof SORTABLE)[number];

/** A sortable column header: a Link that toggles ?sort=&dir=, preserving filters. */
function SortHead({
  href,
  dir,
  numeric = false,
  children,
}: {
  href: string;
  dir: SortDirection;
  numeric?: boolean;
  children: React.ReactNode;
}) {
  const Icon =
    dir === "asc" ? ChevronUp : dir === "desc" ? ChevronDown : ArrowUpDown;
  return (
    <TableHead
      numeric={numeric}
      aria-sort={
        dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"
      }
      className="group p-0"
    >
      <Link
        href={href}
        scroll={false}
        className={cn(
          "hover:text-foreground flex h-10 w-full items-center gap-1.5 px-4 transition-colors",
          numeric && "flex-row-reverse"
        )}
      >
        {children}
        <Icon
          className={cn(
            "size-3.5 shrink-0 transition-opacity",
            dir ? "opacity-100" : "opacity-50 group-hover:opacity-100"
          )}
          aria-hidden
        />
      </Link>
    </TableHead>
  );
}

type SearchParams = Promise<{
  q?: string;
  type?: string;
  status?: string;
  sort?: string;
  dir?: string;
}>;

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAgencyUser();
  const t = await getTranslations("suppliers");
  const sp = await searchParams;

  const suppliers = await getSuppliers({
    ...(sp.q && { search: sp.q }),
    ...(sp.type && { type: sp.type }),
    ...(sp.status && { status: sp.status }),
  });

  const hasFilters = Boolean(sp.q || sp.type || sp.status);

  // Sort the already-loaded page (default: most bookings first, then name).
  const sortKey = (sp.sort && SORTABLE.includes(sp.sort as SortKey)
    ? sp.sort
    : "bookings") as SortKey;
  const sortDir: "asc" | "desc" =
    sp.dir === "asc" || sp.dir === "desc"
      ? sp.dir
      : sortKey === "bookings"
        ? "desc"
        : "asc";

  const locationOf = (s: (typeof suppliers)[number]) =>
    [s.city, s.country].filter(Boolean).join(", ");

  const sorted = [...suppliers].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "bookings":
        cmp = (a.bookingItemCount ?? 0) - (b.bookingItemCount ?? 0);
        break;
      case "type":
        cmp = a.type.localeCompare(b.type);
        break;
      case "status":
        cmp = a.status.localeCompare(b.status);
        break;
      case "location":
        cmp = locationOf(a).localeCompare(locationOf(b));
        break;
      default:
        cmp = a.name.localeCompare(b.name);
    }
    if (cmp === 0) cmp = a.name.localeCompare(b.name);
    return sortDir === "asc" ? cmp : -cmp;
  });

  // Build a sort-toggle href that preserves the active filters.
  const sortHref = (key: SortKey): string => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.type) params.set("type", sp.type);
    if (sp.status) params.set("status", sp.status);
    params.set("sort", key);
    const nextDir =
      sortKey === key
        ? sortDir === "asc"
          ? "desc"
          : "asc"
        : key === "bookings"
          ? "desc"
          : "asc";
    params.set("dir", nextDir);
    return `/suppliers?${params.toString()}`;
  };
  const dirFor = (key: SortKey): SortDirection =>
    sortKey === key ? sortDir : false;

  // Summary counts from already-loaded rows (no extra query).
  const statusCounts = suppliers.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader title={t("title")} description={t("description")}>
        <Button asChild>
          <Link href="/suppliers/new">
            <Plus className="mr-2 size-4" />
            {t("addSupplier")}
          </Link>
        </Button>
      </PageHeader>

      {/* Summary header — total + by-status, derived from loaded rows. */}
      {suppliers.length > 0 && (
        <Card className="card-elevated">
          <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
            <div>
              <p className="text-2xl font-bold tracking-tight tabular-nums">
                {suppliers.length}
              </p>
              <p className="text-muted-foreground text-sm">{t("total")}</p>
            </div>
            <div className="bg-border hidden h-10 w-px sm:block" />
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {STATUS_ORDER.map((s) => {
                const meta = SUPPLIER_STATUS_META[s];
                return (
                  <div key={s} className="flex items-center gap-2">
                    <StatusBadge
                      label={meta.label}
                      variant={statusTone("supplier", s)}
                    />
                    <span className="text-sm font-semibold tabular-nums">
                      {statusCounts[s] ?? 0}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <form className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder={t("searchPlaceholder")}
          className="sm:max-w-xs"
        />
        <Select name="type" defaultValue={sp.type ?? ""} className="sm:max-w-[180px]">
          <option value="">{t("allTypes")}</option>
          {SUPPLIER_TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {SUPPLIER_TYPE_META[ty].label}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={sp.status ?? ""} className="sm:max-w-[160px]">
          <option value="">{t("allStatuses")}</option>
          {SUPPLIER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {SUPPLIER_STATUS_META[s].label}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          {t("filter")}
        </Button>
        {hasFilters && (
          <Button asChild variant="ghost">
            <Link href="/suppliers">{t("clear")}</Link>
          </Button>
        )}
      </form>

      {suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={hasFilters ? t("noMatch") : t("noSuppliers")}
          description={hasFilters ? t("noMatchDesc") : t("noSuppliersDesc")}
          action={
            !hasFilters && (
              <Button asChild>
                <Link href="/suppliers/new">
                  <Plus className="mr-2 size-4" />
                  {t("addSupplier")}
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <Card className="card-elevated overflow-hidden p-0">
          <div className="max-h-[70vh] overflow-auto">
            <Table>
              <TableHeader sticky>
                <TableRow className="hover:bg-transparent">
                  <SortHead href={sortHref("name")} dir={dirFor("name")}>
                    {t("table.name")}
                  </SortHead>
                  <SortHead href={sortHref("type")} dir={dirFor("type")}>
                    {t("table.type")}
                  </SortHead>
                  <SortHead href={sortHref("status")} dir={dirFor("status")}>
                    {t("table.status")}
                  </SortHead>
                  <SortHead href={sortHref("location")} dir={dirFor("location")}>
                    {t("table.location")}
                  </SortHead>
                  <SortHead
                    href={sortHref("bookings")}
                    dir={dirFor("bookings")}
                    numeric
                  >
                    {t("table.bookings")}
                  </SortHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((s) => {
                  const typeMeta = SUPPLIER_TYPE_META[s.type as SupplierType];
                  const statusMeta =
                    SUPPLIER_STATUS_META[s.status as SupplierStatus];
                  const TypeIcon = TYPE_ICONS[s.type as SupplierType] ?? Package;
                  const location = locationOf(s) || "—";
                  return (
                    // Full-row navigation: an absolutely-positioned overlay Link
                    // makes the whole row a single honest click target.
                    <TableRow key={s.id} className="group relative">
                      <TableCell>
                        <Link
                          href={`/suppliers/${s.id}`}
                          className="absolute inset-0 z-0"
                          aria-label={s.name}
                        />
                        <span className="relative z-10 flex items-center gap-3">
                          <ClientAvatar name={s.name} className="size-9 text-xs" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium group-hover:underline">
                              {s.name}
                            </span>
                            {s.email && (
                              <span className="text-muted-foreground block truncate text-xs">
                                {s.email}
                              </span>
                            )}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
                          <TypeIcon className="size-3.5" />
                          {typeMeta?.label ?? s.type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          label={statusMeta?.label ?? s.status}
                          variant={statusTone("supplier", s.status)}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {location}
                      </TableCell>
                      <TableCell numeric className="font-medium">
                        <span className="relative z-10 inline-flex items-center gap-1">
                          {s.bookingItemCount ?? 0}
                          <ChevronRight className="text-muted-foreground/50 size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
