"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  generateProposalLink,
  revokeProposalLink,
} from "@/lib/actions/products";

/**
 * Manage the public, signable proposal link from the internal product page:
 * create/rotate the share token, copy the link, or revoke it.
 */
export function ProposalShareControl({
  productId,
  shareToken,
}: {
  productId: string;
  shareToken: string | null;
}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(shareToken);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const url =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/p/${token}`
      : "";

  const create = () =>
    startTransition(async () => {
      const res = await generateProposalLink(productId);
      if (res.ok && res.data?.token) {
        setToken(res.data.token);
        router.refresh();
      } else {
        toast.error((!res.ok && res.error) || "Could not create the link.");
      }
    });

  const revoke = () =>
    startTransition(async () => {
      const res = await revokeProposalLink(productId);
      if (res.ok) {
        setToken(null);
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not revoke the link.");
      }
    });

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 className="mr-2 size-4" />
          Share &amp; sign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Shareable proposal link</DialogTitle>
          <DialogDescription>
            Send this link to your client. They can review and e-sign the
            proposal without an account.
          </DialogDescription>
        </DialogHeader>

        {token ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={copy}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={revoke}
              disabled={pending}
            >
              <Trash2 className="mr-1 size-4" /> Revoke link
            </Button>
          </div>
        ) : (
          <Button type="button" onClick={create} disabled={pending}>
            <Link2 className="mr-2 size-4" /> Create sign link
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
