import {
  Download,
  FileText,
  Plane,
  Receipt,
  ScrollText,
  Ticket,
} from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";

export type BookingDocumentRow = {
  id: string;
  type: string;
  providerId: string | null;
  url: string | null;
  generatedAt: Date | string | null;
  createdAt: Date | string;
};

// type -> presentation. Falls back to a generic file icon for unknown types.
const DOC_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; iconClass: string }
> = {
  voucher: { label: "Voucher", icon: ScrollText, iconClass: "text-blue-600 dark:text-blue-400" },
  ticket: { label: "E-ticket", icon: Ticket, iconClass: "text-violet-600 dark:text-violet-400" },
  invoice: { label: "Invoice", icon: Receipt, iconClass: "text-green-600 dark:text-green-400" },
  itinerary: { label: "Itinerary", icon: Plane, iconClass: "text-blue-600 dark:text-blue-400" },
  receipt: { label: "Receipt", icon: Receipt, iconClass: "text-green-600 dark:text-green-400" },
};

/**
 * Documents list (deck: Documents panel).
 *
 * Rows come from booking_document real columns (type / providerId / url /
 * generatedAt). "Ready" vs "Pending" is derived from whether a downloadable
 * `url` exists — no fabricated file sizes. Omitted entirely when there are no
 * documents. The system's on-demand voucher / invoice routes remain available
 * from the page header regardless of this list.
 */
export function BookingDocuments({ documents }: { documents: BookingDocumentRow[] }) {
  if (documents.length === 0) return null;

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-4" /> Documents
          <span className="text-muted-foreground ml-1 text-xs font-normal">
            {documents.length} {documents.length === 1 ? "file" : "files"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {documents.map((d) => {
            const meta = DOC_META[d.type] ?? {
              label: d.type,
              icon: FileText,
              iconClass: "text-muted-foreground",
            };
            const Icon = meta.icon;
            const ready = Boolean(d.url);
            return (
              <li key={d.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
                  <Icon className={`size-4 ${meta.iconClass}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium capitalize">
                    {meta.label}
                    {d.providerId && (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · {d.providerId}
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {ready ? "Generated" : "Pending"} ·{" "}
                    {formatDate(d.generatedAt ?? d.createdAt)}
                  </p>
                </div>
                <StatusBadge
                  label={ready ? "Ready" : "Pending"}
                  variant={ready ? "success" : "warning"}
                  dot
                />
                {ready ? (
                  <Button asChild variant="ghost" size="icon" aria-label={`Download ${meta.label}`}>
                    <a href={d.url!} target="_blank" rel="noopener noreferrer">
                      <Download className="size-4" />
                    </a>
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled
                    aria-label={`${meta.label} not ready`}
                  >
                    <Download className="size-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
