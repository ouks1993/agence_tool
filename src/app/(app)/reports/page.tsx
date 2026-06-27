import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { ReportsExport } from "@/components/reports/reports-export";
import { canViewFinance, roleHome } from "@/lib/domain";
import { requireAgencyUser } from "@/lib/permissions";

export const metadata = { title: "Reports & export" };

export default async function ReportsPage() {
  const user = await requireAgencyUser();
  // Export carries finance-grade data — limit to admin / manager / finance.
  if (!canViewFinance(user.role)) redirect(roleHome(user.role));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Reports & export"
        description="Download clean, standardized data for Excel, Power BI and reporting."
      />
      <ReportsExport />
    </div>
  );
}
