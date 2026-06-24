import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageTeam, type UserRole } from "@/lib/domain";
import { agency } from "@/lib/schema";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  // The agency this user belongs to. NULL only for the platform super-admin (vendor).
  agencyId: string | null;
  isPlatformAdmin: boolean;
  role: UserRole;
  active: boolean;
};

/** A user guaranteed to belong to an agency (agencyId is non-null). */
export type AgencyUser = CurrentUser & { agencyId: string };

/**
 * Returns the authenticated user (including role), or redirects to /login.
 * Use at the top of every protected Server Component / layout.
 */
export async function requireUser(): Promise<CurrentUser> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  const u = session.user as unknown as {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    agencyId?: string | null;
    isPlatformAdmin?: boolean;
    role?: string;
    active?: boolean;
  };

  // A deactivated team member is signed out of the app.
  if (u.active === false) {
    redirect("/login?error=account_disabled");
  }

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image ?? null,
    agencyId: u.agencyId ?? null,
    isPlatformAdmin: u.isPlatformAdmin ?? false,
    role: (u.role as UserRole) ?? "agent",
    active: u.active ?? true,
  };
}

/**
 * Returns the user only if they belong to an agency (agencyId is non-null).
 * Use at the top of every tenant-scoped page/action so downstream queries can
 * safely scope by `user.agencyId`. The platform super-admin (no agency) is sent
 * to their own console.
 */
export async function requireAgencyUser(): Promise<AgencyUser> {
  const user = await requireUser();
  if (user.isPlatformAdmin) redirect("/platform");
  if (!user.agencyId) redirect("/login?error=no_agency");

  // A suspended agency locks out all of its users.
  const ag = await db.query.agency.findFirst({
    where: eq(agency.id, user.agencyId),
    columns: { status: true },
  });
  if (!ag || ag.status !== "active") {
    redirect("/login?error=agency_suspended");
  }

  return user as AgencyUser;
}

/** Returns the user only if they are the platform super-admin, else redirects to /dashboard. */
export async function requirePlatformAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/dashboard");
  return user;
}

/** Returns the user only if they can manage the team (admin or manager), otherwise redirects to /dashboard. */
export async function requireManager(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!canManageTeam(user.role)) {
    redirect("/dashboard");
  }
  return user;
}

export function isManager(user: { role: UserRole }): boolean {
  return canManageTeam(user.role);
}

/**
 * Returns the user only if their role satisfies the given capability check,
 * otherwise redirects (defaults to /dashboard). Pass any capability helper
 * from @/lib/domain, e.g. requireCapability(canManagePayments).
 */
export async function requireCapability(
  check: (role: UserRole) => boolean,
  redirectTo = "/dashboard"
): Promise<CurrentUser> {
  const user = await requireUser();
  if (!check(user.role)) redirect(redirectTo);
  return user;
}

/** Optional session lookup that never redirects. */
export async function getOptionalUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as unknown as {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    agencyId?: string | null;
    isPlatformAdmin?: boolean;
    role?: string;
    active?: boolean;
  };
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image ?? null,
    agencyId: u.agencyId ?? null,
    isPlatformAdmin: u.isPlatformAdmin ?? false,
    role: (u.role as UserRole) ?? "agent",
    active: u.active ?? true,
  };
}
