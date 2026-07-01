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
    <div className="bg-muted/30 min-h-screen py-8 print:min-h-0 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl px-4 print:max-w-none print:px-0">
        <div className="doc-print-hidden mb-4 flex justify-end">
          <PrintButton />
        </div>
        <div className="bg-card rounded-lg border p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <div className="doc-avoid-break flex items-start justify-between border-b pb-6">
            <div className="flex items-center gap-3">
              {/* Atlas brandmark — gradient chip matching the app shell logo mark. */}
              <div className="from-primary to-[#3E72E0] flex size-11 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                <span className="text-lg font-extrabold leading-none">
                  {APP_NAME.charAt(0)}
                </span>
              </div>
              <div>
                <p className="from-primary to-primary/70 bg-gradient-to-r bg-clip-text text-xl font-bold text-transparent print:bg-none print:text-[#2B59C3]">
                  {APP_NAME}
                </p>
                <p className="text-muted-foreground text-sm">{APP_TAGLINE}</p>
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-lg font-bold tracking-tight uppercase">{docType}</h1>
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
