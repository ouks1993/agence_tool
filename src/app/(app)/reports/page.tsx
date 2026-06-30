import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { PeriodPills } from "@/components/reports/period-pills";
import {
  ReportsAnalytics,
  ReportsAnalyticsSkeleton,
} from "@/components/reports/reports-analytics";
import { ReportsExport } from "@/components/reports/reports-export";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { canViewFinance, roleHome } from "@/lib/domain";
import { requireAgencyUser } from "@/lib/permissions";
import { parsePeriod, resolvePeriodWindow } from "@/lib/reports/period";

export const metadata = { title: "Reports & analytics" };

const MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
});

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const user = await requireAgencyUser();
  // Reports carry finance-grade data — limit to admin / manager / finance.
  if (!canViewFinance(user.role)) redirect(roleHome(user.role));

  const period = parsePeriod((await searchParams).period);
  const now = new Date();
  const window = resolvePeriodWindow(period, now);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Reports &amp; analytics</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header — title + subtitle on the left, period pills + export on the right */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Reports &amp; analytics</h1>
          <p className="text-muted-foreground text-sm">
            {MONTH_YEAR.format(now)} · figures in DZD · vs previous period
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PeriodPills active={period} />
          <Button asChild variant="outline" size="sm">
            <a href="#export">
              <Download className="mr-1.5 size-4" />
              Export
            </a>
          </Button>
        </div>
      </div>

      {/* Analytics dashboard — primary view. Wrapped in Suspense so the page
          shell streams while the agency-wide queries resolve. */}
      <Suspense fallback={<ReportsAnalyticsSkeleton />}>
        <ReportsAnalytics agencyId={user.agencyId} period={period} window={window} />
      </Suspense>

      {/* Export section — preserves the original CSV/Excel export hub. The
          header "Export" button scrolls here via the #export anchor. */}
      <section id="export" className="scroll-mt-6 space-y-4 pt-2">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Export data</h2>
          <p className="text-muted-foreground text-sm">
            Download clean, standardized data for Excel, Power BI and reporting.
          </p>
        </div>
        <ReportsExport />
      </section>
    </div>
  );
}
