"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Mail, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendPortalInvite } from "@/lib/actions/portal-invite";
import { cn } from "@/lib/utils";

export function PortalInviteButton({
  clientId,
  clientEmail,
  variant = "outline",
  fullWidth = false,
  label,
}: {
  clientId: string;
  clientEmail: string | null;
  /** Button style; the action rail uses "ghost". */
  variant?: "outline" | "ghost";
  /** Stretch to fill its container and left-align (action-rail layout). */
  fullWidth?: boolean;
  /** Override the default "Send portal invite" label. */
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  // The portal URL is revealed after a successful send so the agent can copy it
  // manually when email delivery isn't configured.
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const onClick = () => {
    startTransition(async () => {
      const res = await sendPortalInvite(clientId);
      if (res.ok) {
        toast.success(
          clientEmail ? `Invite sent to ${clientEmail}` : "Invite ready"
        );
        setPortalUrl(res.data?.portalUrl ?? null);
        setCopied(false);
      } else {
        toast.error(res.error);
      }
    });
  };

  const onCopy = async () => {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      toast.success("Portal link copied");
      // Reset the inline confirmation so the button can be reused.
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const Icon = fullWidth ? Share2 : Mail;

  return (
    <div className="flex flex-col items-stretch gap-2">
      <Button
        variant={variant}
        size="sm"
        onClick={onClick}
        disabled={pending}
        className={cn(fullWidth && "w-full justify-start")}
      >
        <Icon className="mr-2 size-4" />
        {pending ? "Sending…" : (label ?? "Send portal invite")}
      </Button>

      {portalUrl && (
        <div className="flex items-center gap-2 rounded-md border bg-muted p-2">
          <code className="min-w-0 flex-1 truncate text-xs">{portalUrl}</code>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={onCopy}
            aria-label="Copy portal link"
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
