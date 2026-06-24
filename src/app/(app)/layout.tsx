import { eq } from "drizzle-orm";
import { Eye } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { exitAgencyView } from "@/lib/actions/platform";
import { db } from "@/lib/db";
import { isViewingAsAgency, requireAgencyUser } from "@/lib/permissions";
import { agency } from "@/lib/schema";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAgencyUser();

  // When the platform admin is "viewing as" an agency, show a banner with the
  // agency name and a way back to the platform console.
  const impersonating = isViewingAsAgency(user);
  const viewedAgency = impersonating
    ? await db.query.agency.findFirst({
        where: eq(agency.id, user.agencyId),
        columns: { name: true },
      })
    : null;

  return (
    <>
      {impersonating && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-sm text-amber-700 dark:text-amber-300">
          <span className="flex items-center gap-1.5">
            <Eye className="size-4" />
            Viewing{" "}
            <strong className="font-semibold">
              {viewedAgency?.name ?? "agency"}
            </strong>{" "}
            as platform admin
          </span>
          <form action={exitAgencyView}>
            <button type="submit" className="font-medium underline underline-offset-2">
              Exit to platform
            </button>
          </form>
        </div>
      )}
      <AppShell
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        }}
      >
        {children}
      </AppShell>
    </>
  );
}
