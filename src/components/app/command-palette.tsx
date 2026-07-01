"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Briefcase, FileText, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { visibleSections } from "@/components/app/nav-config";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { UserRole } from "@/lib/domain";

/** Minimal entity records the palette can jump to. Sourced from real queries. */
export type PaletteEntities = {
  clients: { id: string; name: string }[];
  bookings: { id: string; label: string }[];
  proposals: { id: string; label: string }[];
};

const EMPTY_ENTITIES: PaletteEntities = {
  clients: [],
  bookings: [],
  proposals: [],
};

export function CommandPalette({
  role,
  entities,
}: {
  role: UserRole;
  entities?: PaletteEntities | undefined;
}) {
  const data = entities ?? EMPTY_ENTITIES;
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const tNav = useTranslations("nav");
  const tSearch = useTranslations("search");

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    // Custom event lets the topbar search button open the palette.
    const openHandler = () => setOpen(true);
    document.addEventListener("atlas:open-command-palette", openHandler);
    return () => {
      document.removeEventListener("keydown", down);
      document.removeEventListener("atlas:open-command-palette", openHandler);
    };
  }, []);

  const go = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const sections = React.useMemo(() => visibleSections(role), [role]);

  const hasEntities =
    data.clients.length > 0 ||
    data.bookings.length > 0 ||
    data.proposals.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={tSearch("commandTitle")}
      description={tSearch("commandDescription")}
    >
      <CommandInput placeholder={tSearch("commandPlaceholder")} />
      <CommandList>
        <CommandEmpty>{tSearch("commandEmpty")}</CommandEmpty>

        {data.clients.length > 0 && (
          <CommandGroup heading={tNav("clients")}>
            {data.clients.map((c) => (
              <CommandItem
                key={`client-${c.id}`}
                value={`client ${c.name}`}
                onSelect={() => go(`/clients/${c.id}`)}
              >
                <Users />
                <span className="truncate">{c.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {data.bookings.length > 0 && (
          <CommandGroup heading={tNav("bookings")}>
            {data.bookings.map((b) => (
              <CommandItem
                key={`booking-${b.id}`}
                value={`booking ${b.label}`}
                onSelect={() => go(`/bookings/${b.id}`)}
              >
                <Briefcase />
                <span className="truncate">{b.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {data.proposals.length > 0 && (
          <CommandGroup heading={tNav("proposals")}>
            {data.proposals.map((p) => (
              <CommandItem
                key={`proposal-${p.id}`}
                value={`proposal ${p.label}`}
                onSelect={() => go(`/proposals/${p.id}`)}
              >
                <FileText />
                <span className="truncate">{p.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasEntities && <CommandSeparator />}

        {sections.map((section) => (
          <CommandGroup
            key={section.labelKey ?? "_top"}
            heading={section.labelKey ? tNav(section.labelKey) : tSearch("commandNav")}
          >
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.href}
                  value={`nav ${tNav(item.labelKey)} ${item.href}`}
                  onSelect={() => go(item.href)}
                >
                  <Icon />
                  <span>{tNav(item.labelKey)}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}

        <CommandSeparator />
        <CommandGroup>
          <CommandItem value="search everything sourcing" onSelect={() => go("/search")}>
            <ArrowRight />
            <span>{tSearch("commandSearchEverything")}</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
