import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { describeActivity } from "@/lib/activity-format";
import { formatRelative, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ActivityItem = {
  id: string;
  action: string;
  entityType: string;
  entityLabel: string | null;
  metadata: unknown;
  createdAt: Date;
  user: { name: string } | null;
};

// Map the activity action to a timeline dot tone (Wave-1 status tokens).
function toneFor(action: string): string {
  if (action === "created" || action === "sent") return "bg-success";
  if (action === "deleted") return "bg-danger";
  if (action === "stage_changed" || action === "status_changed") return "bg-warning";
  return "bg-muted-foreground/40";
}

// Actor label for a row. Team actions carry a real user; portal/public-link
// actions (a client accepting/declining a proposal) are recorded with a null
// user and a `via` marker in metadata — those are the client acting, not an
// unknown "Someone".
function actorLabel(item: ActivityItem): { name: string; qualifier?: string } {
  if (item.user?.name) return { name: item.user.name };
  const via = (item.metadata as { via?: string } | null)?.via;
  if (via === "client_portal" || via === "public_link") {
    return { name: "Client", qualifier: "(portal)" };
  }
  return { name: "System" };
}

/**
 * Recent-activity as a connected timeline: a vertical rail with a colored
 * status dot per event (keyed to the real activity action), an avatar, the
 * describeActivity sentence, and a relative timestamp. Data is the real
 * activityLog — only the presentation changes vs. the old flat list.
 */
export function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="relative space-y-5 before:absolute before:top-1 before:bottom-1 before:left-[5px] before:w-px before:bg-border">
      {items.map((a) => {
        const actor = actorLabel(a);
        return (
        <li key={a.id} className="relative flex items-start gap-3 pl-5">
          <span
            className={cn(
              "absolute top-1 left-0 size-[11px] rounded-full ring-4 ring-card",
              toneFor(a.action)
            )}
            aria-hidden
          />
          <Avatar className="size-7 shrink-0">
            <AvatarFallback className="text-xs">
              {initials(a.user?.name ?? actor.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug">
              <span className="font-medium">{actor.name}</span>
              {actor.qualifier && (
                <span className="text-muted-foreground"> {actor.qualifier}</span>
              )}{" "}
              {describeActivity(a)}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {formatRelative(a.createdAt)}
            </p>
          </div>
        </li>
        );
      })}
    </ul>
  );
}
