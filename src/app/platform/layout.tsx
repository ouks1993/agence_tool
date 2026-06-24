import Link from "next/link";
import { Building2 } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requirePlatformAdmin } from "@/lib/permissions";

export const metadata = { title: "Platform" };

/**
 * Layout for the vendor (platform) console. This is a separate area from the
 * tenant app: it guards every page with requirePlatformAdmin and renders its own
 * lightweight nav strip instead of the tenant AppShell. It still inherits the root
 * layout's SiteHeader/SiteFooter.
 */
export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Guard the whole console: non-platform users are redirected to /dashboard.
  await requirePlatformAdmin();

  return (
    <div>
      <div className="border-b">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
          <Link
            href="/platform"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <span className="bg-primary/10 flex size-8 items-center justify-center rounded-lg">
              <Building2 className="text-primary size-5" />
            </span>
            Platform console
          </Link>
          <SignOutButton />
        </div>
      </div>
      <main>{children}</main>
    </div>
  );
}
