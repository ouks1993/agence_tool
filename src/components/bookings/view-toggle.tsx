"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, List } from "lucide-react";
import { Button } from "@/components/ui/button";

type View = "list" | "board";

/**
 * List/Board switch for the Bookings page. Toggles the `view` search param
 * while preserving any existing filter params already in the URL.
 */
export function BookingsViewToggle({ view }: { view: View }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const switchTo = (next: View) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "list") {
      // List is the default — keep the URL clean.
      params.delete("view");
    } else {
      params.set("view", next);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="flex items-center rounded-md border p-0.5">
      <Button
        type="button"
        size="sm"
        variant={view === "list" ? "secondary" : "ghost"}
        className="h-7 px-2"
        onClick={() => switchTo("list")}
        aria-label="List view"
        aria-pressed={view === "list"}
      >
        <List className="size-4" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant={view === "board" ? "secondary" : "ghost"}
        className="h-7 px-2"
        onClick={() => switchTo("board")}
        aria-label="Board view"
        aria-pressed={view === "board"}
      >
        <LayoutDashboard className="size-4" />
      </Button>
    </div>
  );
}
