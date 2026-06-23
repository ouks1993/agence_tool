import { Compass } from "lucide-react";
import { PrintButton } from "@/components/products/print-button";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { formatDate } from "@/lib/format";

/** Branded, printable A4-style document wrapper for invoices, vouchers, etc. */
export function DocShell({
  docType,
  reference,
  date,
  children,
}: {
  docType: string;
  reference: string;
  date: Date | string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-muted/30 min-h-screen py-8 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-4 flex justify-end">
          <PrintButton />
        </div>
        <div className="bg-card rounded-lg border p-8 shadow-sm print:border-0 print:shadow-none">
          <div className="flex items-start justify-between border-b pb-6">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 flex size-11 items-center justify-center rounded-lg">
                <Compass className="text-primary size-6" />
              </div>
              <div>
                <p className="text-xl font-bold">{APP_NAME}</p>
                <p className="text-muted-foreground text-sm">{APP_TAGLINE}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold tracking-tight uppercase">{docType}</p>
              <p className="text-muted-foreground font-mono text-xs">{reference}</p>
              <p className="text-muted-foreground text-xs">{formatDate(date)}</p>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
