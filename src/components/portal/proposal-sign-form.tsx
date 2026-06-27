"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  acceptProposalFromPortal,
  declineProposalFromPortal,
} from "@/lib/actions/portal-proposals";

/**
 * Portal-side accept/decline form for a proposal. Typing the full name is the
 * signature; the signer's identity comes from the portal session server-side.
 */
export function ProposalSignForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [signature, setSignature] = useState("");
  const [pending, startTransition] = useTransition();

  // Name must be at least 2 chars before acceptance is allowed.
  const canAccept = signature.trim().length >= 2;

  const handleAccept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAccept) {
      toast.error("Please type your full name to sign.");
      return;
    }
    startTransition(async () => {
      const res = await acceptProposalFromPortal(productId, signature.trim());
      if (res.ok) {
        toast.success("Proposal accepted!");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not accept the proposal.");
      }
    });
  };

  const handleDecline = () => {
    startTransition(async () => {
      const res = await declineProposalFromPortal(productId);
      if (res.ok) {
        toast.success("Proposal declined.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not decline the proposal.");
      }
    });
  };

  return (
    <form onSubmit={handleAccept} className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <PenLine className="size-4" /> Accept &amp; sign
      </div>
      <div className="space-y-2">
        <Label htmlFor="signature">Type your full name to sign</Label>
        <Input
          id="signature"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder="Your full name"
          className="font-medium italic"
          required
        />
        <p className="text-muted-foreground text-xs">
          By signing you confirm acceptance of this proposal and its price.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending || !canAccept}>
          <Check className="mr-1 size-4" /> I accept this proposal
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleDecline}
          disabled={pending}
        >
          Decline
        </Button>
      </div>
    </form>
  );
}
