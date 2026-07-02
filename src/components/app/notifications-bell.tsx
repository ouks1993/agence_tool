"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type InboxNotification,
  type InboxSnapshot,
} from "@/lib/actions/user-notifications";
import { cn } from "@/lib/utils";

/** How often to refresh just the badge count while the tab is visible. */
const BADGE_REFRESH_MS = 60_000;

/** Formats a createdAt into a short relative label, e.g. "3 hours ago". */
function relativeTime(date: Date): string {
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "";
  }
}

/**
 * Topbar notification bell + unread badge + dropdown inbox.
 *
 * Hydrates from server-fetched `initial` data, then:
 *   - refetches the full list when the popover opens, and
 *   - polls only the badge count every 60s while the tab is visible.
 */
export function NotificationsBell({ initial }: { initial: InboxSnapshot }) {
  const router = useRouter();
  const [items, setItems] = useState<InboxNotification[]>(initial.items);
  const [unreadCount, setUnreadCount] = useState(initial.unreadCount);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Latest server snapshot → local state (dates arrive as Date over the RSC
  // action boundary).
  const applySnapshot = useCallback((snap: InboxSnapshot) => {
    setItems(snap.items);
    setUnreadCount(snap.unreadCount);
  }, []);

  // Refetch the full inbox when the popover opens.
  useEffect(() => {
    if (!open) return;
    let active = true;
    void getMyNotifications().then((snap) => {
      if (active) applySnapshot(snap);
    });
    return () => {
      active = false;
    };
  }, [open, applySnapshot]);

  // Light badge-count polling, only while the tab is visible.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void getMyNotifications().then((snap) => setUnreadCount(snap.unreadCount));
    };
    const timer = window.setInterval(tick, BADGE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const handleItemClick = (n: InboxNotification) => {
    setOpen(false);
    if (!n.readAt) {
      // Optimistically mark read locally, then persist.
      setItems((prev) =>
        prev.map((it) => (it.id === n.id ? { ...it, readAt: new Date() } : it))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      startTransition(() => {
        void markNotificationRead(n.id);
      });
    }
    if (n.href) router.push(n.href);
  };

  const handleMarkAll = () => {
    setItems((prev) =>
      prev.map((it) => (it.readAt ? it : { ...it, readAt: new Date() }))
    );
    setUnreadCount(0);
    startTransition(() => {
      void markAllNotificationsRead();
    });
  };

  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="focus-visible:ring-ring/50 relative focus-visible:ring-[3px]"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span
              className="bg-destructive text-destructive-foreground absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums"
              aria-hidden="true"
            >
              {badgeLabel}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAll}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-sm text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:outline-none"
            >
              Mark all read
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="text-muted-foreground px-4 py-8 text-center text-sm">
            You&apos;re all caught up.
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto py-1">
            {items.map((n) => {
              const unread = !n.readAt;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleItemClick(n)}
                    className="hover:bg-accent focus-visible:bg-accent flex w-full items-start gap-2.5 px-4 py-2.5 text-start transition-colors focus-visible:outline-none"
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-1.5 shrink-0 rounded-full",
                        unread ? "bg-info" : "bg-transparent"
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-sm",
                          unread
                            ? "text-foreground font-medium"
                            : "text-muted-foreground"
                        )}
                      >
                        {n.title}
                      </span>
                      {n.body && (
                        <span className="text-muted-foreground mt-0.5 line-clamp-2 block text-xs">
                          {n.body}
                        </span>
                      )}
                      <span className="text-muted-foreground mt-0.5 block text-[11px]">
                        {relativeTime(n.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
