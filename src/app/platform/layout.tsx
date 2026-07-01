import Link from "next/link";
import { Building2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ConsoleAccountMenu } from "@/components/platform/console-account-menu";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { APP_NAME } from "@/lib/config";
import { requirePlatformAdmin } from "@/lib/permissions";

export const metadata = { title: "Platform" };

/**
 * Layout for the vendor (platform) console. This is a separate area from the
 * tenant app: it guards every page with requirePlatformAdmin. It adopts the
 * marketing-deck identity — a dark-ink (#0E1525) top rail using the sidebar-*
 * tokens and the gradient brand mark — so the console reads as the same product
 * family as the tenant app, while keeping the distinct "vendor" persona.
 */
export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Guard the whole console: non-platform users are redirected to /dashboard.
  const admin = await requirePlatformAdmin();
  const t = await getTranslations("platform");

  return (
    <div className="bg-background flex min-h-screen flex-col">
      {/* Dark-ink deck rail — matches the tenant AppShell sidebar surface. */}
      <header className="bg-sidebar border-sidebar-border sticky top-0 z-30 border-b">
        <div className="mx-auto flex h-[60px] w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/platform"
            className="flex items-center gap-2.5 focus-visible:outline-none"
          >
            <span className="from-primary to-[#3E72E0] flex size-8 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
              <span className="text-[15px] font-extrabold leading-none">A</span>
            </span>
            <span className="leading-tight">
              <span className="text-sidebar-foreground block text-[15px] font-bold">
                {APP_NAME}
              </span>
              <span className="text-sidebar-foreground/60 flex items-center gap-1 text-[11px]">
                <Building2 className="size-3" />
                {t("vendorConsole")}
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/platform"
              className="text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hidden rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors sm:inline-flex"
            >
              {t("nav.agencies")}
            </Link>
            <ModeToggle className="text-sidebar-foreground/80 hover:text-sidebar-accent-foreground border-sidebar-border bg-transparent hover:bg-sidebar-accent" />
            <ConsoleAccountMenu
              name={admin.name}
              email={admin.email}
              image={admin.image}
            />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
