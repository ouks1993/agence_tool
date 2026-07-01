import type { ReactNode } from "react";
import Link from "next/link";
import { Plane } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { getPortalSession } from "@/lib/portal-session";

/**
 * Minimal layout for the client-facing Traveler Portal — intentionally NOT the
 * staff AppShell (no sidebar, no app nav). Just a branded header and a footer.
 * ThemeProvider and global providers are inherited from the root layout.
 *
 * The nav links and Sign out control are only shown when there is a live portal
 * session, so logged-out visitors on /portal/login see a brand-only header
 * (no authenticated chrome they cannot use).
 */
export default async function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getPortalSession();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-4 px-4 sm:px-6">
          <Link
            href="/portal"
            className="flex items-center gap-2.5 font-semibold"
          >
            <span className="from-primary flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br to-primary/70 text-primary-foreground">
              <Plane className="h-4 w-4" />
            </span>
            <span className="leading-tight">
              {APP_NAME}
              <span className="text-muted-foreground block text-[11px] font-medium">
                Guest portal
              </span>
            </span>
          </Link>
          {session && (
            <nav className="ml-6 hidden items-center gap-1 text-sm sm:flex">
              <Link
                href="/portal"
                className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-1.5 font-medium transition-colors"
              >
                My trips
              </Link>
              <Link
                href="/portal/proposals"
                className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-1.5 font-medium transition-colors"
              >
                Proposals
              </Link>
            </nav>
          )}
          {session && (
            /*
              Sign out is a POST form (not an <a> GET) to prevent CSRF
              forced-logout — a state-changing GET is exploitable via
              `<img src=".../signout">` (CWE-352).
            */
            <form
              method="POST"
              action="/api/portal/auth/signout"
              className="ml-auto"
            >
              <button
                type="submit"
                className="text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
              >
                Sign out
              </button>
            </form>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
      <footer className="border-t bg-card">
        <div className="text-muted-foreground mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-5 text-xs sm:px-6">
          <span>Powered by {APP_NAME}.</span>
        </div>
      </footer>
    </div>
  );
}
