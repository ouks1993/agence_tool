"use client";

import Link from "next/link";
import { LogOut, Search, Settings, User as UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ShellUser } from "@/components/app/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { initials } from "@/lib/format";

function openCommandPalette() {
  document.dispatchEvent(new CustomEvent("atlas:open-command-palette"));
}

/**
 * Persistent desktop topbar over the content column: a global search trigger
 * (opens the ⌘K command palette), theme toggle, and the user account menu.
 */
export function Topbar({
  user,
  onSignOut,
}: {
  user: ShellUser;
  onSignOut: () => void;
}) {
  const tSearch = useTranslations("search");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  return (
    <header className="bg-background/85 border-border sticky top-0 z-20 hidden h-[60px] items-center gap-4 border-b px-6 backdrop-blur-md backdrop-saturate-150 md:flex">
      {/* Global search trigger — matches the mockup .topbar-search */}
      <button
        type="button"
        onClick={openCommandPalette}
        className="border-input bg-muted/60 text-muted-foreground hover:bg-muted hover:border-border-strong focus-visible:ring-ring/50 flex h-9 w-full max-w-sm items-center gap-2 rounded-md border px-3 text-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
        aria-label={tSearch("commandPlaceholder")}
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">{tSearch("commandPlaceholder")}</span>
        <kbd className="border-border bg-background text-muted-foreground ms-auto hidden rounded-sm border px-1.5 py-0.5 font-mono text-[11px] font-medium sm:inline-block">
          ⌘K
        </kbd>
      </button>

      <div className="ms-auto flex items-center gap-2">
        <ModeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="focus-visible:ring-ring/50 rounded-full focus-visible:ring-[3px] focus-visible:outline-none"
              aria-label={user.name}
            >
              <Avatar className="size-9">
                <AvatarImage src={user.image || ""} alt={user.name} />
                <AvatarFallback>{initials(user.name)}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{user.name}</span>
              <span className="text-muted-foreground truncate text-xs font-normal">
                {user.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <UserIcon className="size-4" />
                {tCommon("profile")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="size-4" />
                {tNav("settings")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onSignOut}>
              <LogOut className="size-4" />
              {tCommon("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
