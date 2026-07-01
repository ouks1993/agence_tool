"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type SortDirection,
} from "@/components/ui/table";
import { BOOKING_STATUS_META, type BookingStatus } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { statusTone } from "@/lib/status-tone";

export type BookingListRow = {
  id: string;
  reference: string;
  clientName: string | null;
  destination: string | null;
  departDate: Date | string | null;
  returnDate: Date | string | null;
  pax: number;
  status: string;
  totalAmount: string;
  currency: string;
};

type SortKey = "reference" | "client" | "dates" | "pax" | "status" | "total";

const LIFECYCLE_ORDER: Record<string, number> = {
  draft: 0,
  awaiting_payment: 1,
  confirmed: 2,
  ticketed: 3,
  completed: 4,
  cancelled: 5,
};

function toTime(d: Date | string | null): number {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Sortable, sticky-header bookings list (deck data-table treatment). Sorting is
 * client-side over the already-loaded rows — no refetch — with the whole row
 * navigable to the booking. Numeric columns (Pax / Total) are right-aligned and
 * tabular; Total sorts by the raw amount, not the formatted string.
 */
export function BookingsTable({
  labels,
  rows,
}: {
  labels: {
    reference: string;
    client: string;
    destination: string;
    dates: string;
    status: string;
    total: string;
  };
  rows: BookingListRow[];
}) {
  const router = useRouter();
  const [sort, setSort] = useState<{ key: SortKey; dir: Exclude<SortDirection, false> }>({
    key: "dates",
    dir: "desc",
  });

  const toggle = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "reference" || key === "client" ? "asc" : "desc" }
    );

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sort.key) {
        case "reference":
          cmp = a.reference.localeCompare(b.reference);
          break;
        case "client":
          cmp = (a.clientName ?? "").localeCompare(b.clientName ?? "");
          break;
        case "dates":
          cmp = toTime(a.departDate) - toTime(b.departDate);
          break;
        case "pax":
          cmp = a.pax - b.pax;
          break;
        case "status":
          cmp =
            (LIFECYCLE_ORDER[a.status] ?? 99) - (LIFECYCLE_ORDER[b.status] ?? 99);
          break;
        case "total":
          cmp = parseFloat(a.totalAmount || "0") - parseFloat(b.totalAmount || "0");
          break;
      }
      return cmp * dir;
    });
  }, [rows, sort]);

  const dirOf = (key: SortKey): SortDirection => (sort.key === key ? sort.dir : false);

  return (
    <div className="rounded-lg border">
      <Table zebra>
        <TableHeader sticky>
          <TableRow>
            <TableHead sortable sortDirection={dirOf("reference")} onClick={() => toggle("reference")}>
              {labels.reference}
            </TableHead>
            <TableHead sortable sortDirection={dirOf("client")} onClick={() => toggle("client")}>
              {labels.client}
            </TableHead>
            <TableHead>{labels.destination}</TableHead>
            <TableHead sortable sortDirection={dirOf("dates")} onClick={() => toggle("dates")}>
              {labels.dates}
            </TableHead>
            <TableHead numeric sortable sortDirection={dirOf("pax")} onClick={() => toggle("pax")}>
              Pax
            </TableHead>
            <TableHead sortable sortDirection={dirOf("status")} onClick={() => toggle("status")}>
              {labels.status}
            </TableHead>
            <TableHead numeric sortable sortDirection={dirOf("total")} onClick={() => toggle("total")}>
              {labels.total}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((b) => {
            const meta = BOOKING_STATUS_META[b.status as BookingStatus];
            const href = `/bookings/${b.id}`;
            return (
              <TableRow
                key={b.id}
                onClick={() => router.push(href)}
                className="cursor-pointer"
              >
                <TableCell className="text-muted-foreground font-mono text-xs">
                  <Link
                    href={href}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {b.reference}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{b.clientName ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {b.destination ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs tabular-nums">
                  {b.departDate || b.returnDate
                    ? `${formatDate(b.departDate)} → ${formatDate(b.returnDate)}`
                    : "—"}
                </TableCell>
                <TableCell numeric>
                  <span className="text-muted-foreground inline-flex items-center gap-1">
                    <Users className="size-3" aria-hidden />
                    {b.pax}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge
                    label={meta?.label ?? b.status}
                    variant={statusTone("booking", b.status)}
                    dot
                  />
                </TableCell>
                <TableCell numeric className="font-medium">
                  {formatMoney(b.totalAmount, b.currency)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
