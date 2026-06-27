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
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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

type SearchParams = Promise<{ q?: string; type?: string; status?: string }>;

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAgencyUser();
  const sp = await searchParams;

  const suppliers = await getSuppliers({
    ...(sp.q && { search: sp.q }),
    ...(sp.type && { type: sp.type }),
    ...(sp.status && { status: sp.status }),
  });

  const hasFilters = Boolean(sp.q || sp.type || sp.status);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Suppliers"
        description="Manage the hotels, airlines and partners you book with."
      >
        <Button asChild>
          <Link href="/suppliers/new">
            <Plus className="mr-2 size-4" />
            Add supplier
          </Link>
        </Button>
      </PageHeader>

      {/* Filters */}
      <form className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search by name…"
          className="sm:max-w-xs"
        />
        <Select name="type" defaultValue={sp.type ?? ""} className="sm:max-w-[180px]">
          <option value="">All types</option>
          {SUPPLIER_TYPES.map((t) => (
            <option key={t} value={t}>
              {SUPPLIER_TYPE_META[t].label}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={sp.status ?? ""} className="sm:max-w-[160px]">
          <option value="">All statuses</option>
          {SUPPLIER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {SUPPLIER_STATUS_META[s].label}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {hasFilters && (
          <Button asChild variant="ghost">
            <Link href="/suppliers">Clear</Link>
          </Button>
        )}
      </form>

      {suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={hasFilters ? "No suppliers match your filters" : "No suppliers yet"}
          description={
            hasFilters
              ? "Try clearing the filters."
              : "Add your first supplier to manage contracts and rates."
          }
          action={
            !hasFilters && (
              <Button asChild>
                <Link href="/suppliers/new">
                  <Plus className="mr-2 size-4" />
                  Add supplier
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => {
                const typeMeta = SUPPLIER_TYPE_META[s.type as SupplierType];
                const statusMeta = SUPPLIER_STATUS_META[s.status as SupplierStatus];
                const TypeIcon = TYPE_ICONS[s.type as SupplierType] ?? Package;
                return (
                  <TableRow key={s.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        href={`/suppliers/${s.id}`}
                        className="font-medium hover:underline"
                      >
                        {s.name}
                      </Link>
                      {s.email && (
                        <p className="text-muted-foreground text-xs">{s.email}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="bg-secondary text-secondary-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap">
                        <TypeIcon className="size-3.5" />
                        {typeMeta?.label ?? s.type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={statusMeta?.label ?? s.status}
                        tone={statusMeta?.className}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {[s.city, s.country].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-right">{s.bookingItemCount ?? 0}</TableCell>
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
