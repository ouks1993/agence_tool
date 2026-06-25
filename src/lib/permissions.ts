import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isSubscriptionBlocking } from "@/lib/billing/stripe";
import { db } from "@/lib/db";
import { canManageTeam, type UserRole } from "@/lib/domain";
import { agency, user as userTable } from "@/lib/schema";

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
  // Set when the platform admin is impersonating: "agency" (act as agency admin)
  // or "user" (act as a specific user with their own role/scope).
  impersonating?: "agency" | "user" | null;
};

/** A user guaranteed to belong to an agency (agencyId is non-null). */
export type AgencyUser = CurrentUser & { agencyId: string };

/** Cookie set by the platform admin to "view as" a specific agency. */
export const VIEW_AS_AGENCY_COOKIE = "platform_view_agency";
/** Cookie set by the platform admin to "view as" a specific user. */
export const VIEW_AS_USER_COOKIE = "platform_view_user";

/** True when the platform admin is currently impersonating an agency or a user. */
export function isImpersonating(user: CurrentUser): boolean {
  return user.isPlatformAdmin && !!user.impersonating;
}
/** Back-compat: true when impersonating (agency or user). */
export function isViewingAsAgency(user: CurrentUser): boolean {
  return isImpersonating(user);
}

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

  const base: CurrentUser = {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image ?? null,
    agencyId: u.agencyId ?? null,
    isPlatformAdmin: u.isPlatformAdmin ?? false,
    role: (u.role as UserRole) ?? "agent",
    active: u.active ?? true,
  };

  // Platform-admin impersonation. "View as user" takes precedence over "view as
  // agency": acting as a specific user adopts THEIR identity, agency and role
  // (full fidelity to what that user sees); view-as-agency acts as an agency
  // admin. isPlatformAdmin stays true so /platform still recognizes them and the
  // app can show the "viewing as" banner.
  if (base.isPlatformAdmin) {
    const cookieStore = await cookies();
    const viewUserId = cookieStore.get(VIEW_AS_USER_COOKIE)?.value;
    const viewAgencyId = cookieStore.get(VIEW_AS_AGENCY_COOKIE)?.value;
    if (viewUserId) {
      const target = await db.query.user.findFirst({
        where: eq(userTable.id, viewUserId),
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
          agencyId: true,
          role: true,
        },
      });
      if (target?.agencyId) {
        base.id = target.id;
        base.name = target.name;
        base.email = target.email;
        base.image = target.image ?? null;
        base.agencyId = target.agencyId;
        base.role = (target.role as UserRole) ?? "agent";
        base.impersonating = "user";
      }
    } else if (viewAgencyId) {
      base.agencyId = viewAgencyId;
      base.role = "admin";
      base.impersonating = "agency";
    }
  }

  return base;
}

/**
 * Returns the user only if they belong to an agency (agencyId is non-null).
 * Use at the top of every tenant-scoped page/action so downstream queries can
 * safely scope by `user.agencyId`. The platform super-admin (no agency) is sent
 * to their own console.
 */
export async function requireAgencyUser(): Promise<AgencyUser> {
  const user = await requireUser();

  if (!user.agencyId) {
    // Platform admin without an agency selected goes to their own console.
    if (user.isPlatformAdmin) redirect("/platform");
    redirect("/login?error=no_agency");
  }

  // A suspended agency — or one whose subscription has lapsed — locks out its
  // real members, but the platform admin can still "view as" any agency for
  // support/inspection.
  if (!user.isPlatformAdmin) {
    const ag = await db.query.agency.findFirst({
      where: eq(agency.id, user.agencyId),
      columns: { status: true, subscriptionStatus: true },
    });
    if (!ag || ag.status !== "active") {
      redirect("/login?error=agency_suspended");
    }
    // NULL / trialing / active subscriptions pass; only hard-failed states block.
    if (isSubscriptionBlocking(ag.subscriptionStatus)) {
      redirect("/login?error=subscription_inactive");
    }
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
