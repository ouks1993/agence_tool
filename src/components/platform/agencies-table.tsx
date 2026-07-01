"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Eye,
  ExternalLink,
  MoreHorizontal,
  Power,
  PowerOff,
  Search,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  reactivateAgency,
  suspendAgency,
  viewAsAgency,
} from "@/lib/actions/platform";
import { statusTone } from "@/lib/status-tone";

export type AgencyRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  subscriptionStatus: string | null;
  users: number;
  clients: number;
  bookings: number;
};

type SortKey = "name" | "users" | "clients" | "bookings";

/**
 * The vendor console's primary data-table. Client-side because the console
 * paints the whole tenant list at once (small N) and benefits from instant
 * search / sort / filter without round-trips. Row actions reuse the same
 * server actions as the detail page (suspend / reactivate / view-as-agency).
 */
export function AgenciesTable({ agencies }: { agencies: AgencyRow[] }) {
  const t = useTranslations("platform.agencies");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Text ascends A→Z; counts default to highest-first.
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const dirFor = (key: SortKey): SortDirection =>
    sortKey === key ? sortDir : false;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = agencies.filter((a) => {
      if (status && a.status !== status) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q)
      );
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      return (a[sortKey] - b[sortKey]) * dir;
    });
  }, [agencies, query, status, sortKey, sortDir]);

  const hasFilters = Boolean(query || status);

  const toggleStatus = (agencyId: string, isActive: boolean) => {
    startTransition(async () => {
      const res = isActive
        ? await suspendAgency(agencyId)
        : await reactivateAgency(agencyId);
      if (res.ok) {
        toast.success(isActive ? t("suspend") : t("reactivate"));
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            className="pl-9"
            aria-label={t("search")}
          />
        </div>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="sm:max-w-[180px]"
          aria-label={t("col.status")}
        >
          <option value="">{t("allStatuses")}</option>
          <option value="active">{t("active")}</option>
          <option value="suspended">{t("suspended")}</option>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t("noMatch")}
          description={t("noMatchDesc")}
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setStatus("");
                }}
              >
                {t("clearFilters")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded-lg border">
          <Table zebra>
            <TableHeader sticky>
              <TableRow>
                <TableHead
                  sortable
                  sortDirection={dirFor("name")}
                  onClick={() => toggleSort("name")}
                >
                  {t("col.agency")}
                </TableHead>
                <TableHead>{t("col.status")}</TableHead>
                <TableHead>{t("col.subscription")}</TableHead>
                <TableHead
                  numeric
                  sortable
                  sortDirection={dirFor("users")}
                  onClick={() => toggleSort("users")}
                >
                  {t("col.users")}
                </TableHead>
                <TableHead
                  numeric
                  sortable
                  sortDirection={dirFor("clients")}
                  onClick={() => toggleSort("clients")}
                >
                  {t("col.clients")}
                </TableHead>
                <TableHead
                  numeric
                  sortable
                  sortDirection={dirFor("bookings")}
                  onClick={() => toggleSort("bookings")}
                >
                  {t("col.bookings")}
                </TableHead>
                <TableHead align="right">
                  <span className="sr-only">{t("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => {
                const isActive = a.status === "active";
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link
                        href={`/platform/agencies/${a.id}`}
                        className="block min-w-0 hover:underline"
                      >
                        <p className="font-medium">{a.name}</p>
                        <p className="text-muted-foreground font-mono text-xs">
                          {a.slug}
                        </p>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={isActive ? t("active") : t("suspended")}
                        variant={isActive ? "success" : "danger"}
                        dot
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={subscriptionLabel(a.subscriptionStatus)}
                        variant={statusTone("subscription", a.subscriptionStatus)}
                      />
                    </TableCell>
                    <TableCell numeric>{a.users}</TableCell>
                    <TableCell numeric>{a.clients}</TableCell>
                    <TableCell numeric>{a.bookings}</TableCell>
                    <TableCell align="right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={pending}
                            aria-label={t("actions")}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem asChild>
                            <Link href={`/platform/agencies/${a.id}`}>
                              <Eye className="size-4" />
                              {t("view")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <form action={viewAsAgency.bind(null, a.id)}>
                              <button
                                type="submit"
                                className="flex w-full items-center gap-2"
                              >
                                <ExternalLink className="size-4" />
                                {t("viewApp")}
                              </button>
                            </form>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            {...(isActive
                              ? { variant: "destructive" as const }
                              : {})}
                            onSelect={() => toggleStatus(a.id, isActive)}
                          >
                            {isActive ? (
                              <PowerOff className="size-4" />
                            ) : (
                              <Power className="size-4" />
                            )}
                            {isActive ? t("suspend") : t("reactivate")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

/** Human label for a subscription status (Stripe values are snake_case). */
function subscriptionLabel(status: string | null): string {
  if (!status) return "—";
  return status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
