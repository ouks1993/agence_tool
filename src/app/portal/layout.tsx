import type { ReactNode } from "react";
import Link from "next/link";
import { Plane } from "lucide-react";
import { APP_NAME } from "@/lib/config";

/**
 * Minimal layout for the client-facing Traveler Portal — intentionally NOT the
 * staff AppShell (no sidebar, no app nav). Just a branded header and a footer.
 * ThemeProvider and global providers are inherited from the root layout.
 */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/portal"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Plane className="h-4 w-4 text-primary" />
            </span>
            My Trips
          </Link>
          <a
            href="/api/portal/auth/signout"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </a>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">{children}</main>
      <footer className="border-t">
        <div className="container mx-auto px-4 py-6 text-xs text-muted-foreground">
          Powered by {APP_NAME}.
        </div>
      </footer>
    </div>
  );
}
