import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/lib/domain";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: UserRole;
  active: boolean;
};

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
    role: (u.role as UserRole) ?? "agent",
    active: u.active ?? true,
  };
}

/** Returns the user only if they are a manager, otherwise redirects to /dashboard. */
export async function requireManager(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "manager") {
    redirect("/dashboard");
  }
  return user;
}

export function isManager(user: { role: UserRole }): boolean {
  return user.role === "manager";
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
    role?: string;
    active?: boolean;
  };
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image ?? null,
    role: (u.role as UserRole) ?? "agent",
    active: u.active ?? true,
  };
}
