import { eq } from "drizzle-orm";
import { Eye } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { exitAgencyView } from "@/lib/actions/platform";
import { db } from "@/lib/db";
import { USER_ROLE_META } from "@/lib/domain";
import { isImpersonating, requireAgencyUser } from "@/lib/permissions";
import {
  getShellNavCounts,
  listClientOptions,
  listOpenBookings,
  listProposalOptions,
} from "@/lib/queries";
import { agency } from "@/lib/schema";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAgencyUser();

  // When the platform admin is "viewing as" an agency or a user, show a banner
  // naming what they're viewing and a way back to the platform console.
  const impersonating = isImpersonating(user);
  const viewedAgency = impersonating
    ? await db.query.agency.findFirst({
        where: eq(agency.id, user.agencyId),
        columns: { name: true },
      })
    : null;

  // Shell chrome data (real data only): nav count badges + command-palette
  // jump targets. All scoped to the current agency via requireAgencyUser.
  const [counts, clients, bookings, proposals] = await Promise.all([
    getShellNavCounts(user.agencyId),
    listClientOptions(user.agencyId),
    listOpenBookings(user.agencyId),
    listProposalOptions(user.agencyId),
  ]);

  return (
    <>
      {impersonating && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-warning/30 bg-warning-soft px-4 py-2 text-sm text-warning">
          <span className="flex items-center gap-1.5">
            <Eye className="size-4" />
            {user.impersonating === "user" ? (
              <>
                Viewing as{" "}
                <strong className="font-semibold">{user.name}</strong>
                <span className="opacity-80">
                  ({USER_ROLE_META[user.role].label} · {viewedAgency?.name ?? "agency"})
                </span>
              </>
            ) : (
              <>
                Viewing{" "}
                <strong className="font-semibold">
                  {viewedAgency?.name ?? "agency"}
                </strong>{" "}
                as platform admin
              </>
            )}
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
        counts={counts}
        paletteEntities={{ clients, bookings, proposals }}
      >
        {children}
      </AppShell>
    </>
  );
}
