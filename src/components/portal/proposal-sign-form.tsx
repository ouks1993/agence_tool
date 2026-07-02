"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  acceptProposalFromPortal,
  declineProposalFromPortal,
} from "@/lib/actions/portal-proposals";
import { cn } from "@/lib/utils";

/**
 * Portal-side accept/decline form for a proposal. Typing the full name is the
 * signature; the signer's identity comes from the portal session server-side.
 * Presented as the designed "sign here" card matching the marketing mockup.
 */
export function ProposalSignForm({
  productId,
  depositLabel,
  depositPercent = 50,
}: {
  productId: string;
  /** Formatted deposit figure, or null when the agency takes no deposit. */
  depositLabel?: string | null;
  /** Agency deposit % (drives the "secures your dates" copy). */
  depositPercent?: number;
}) {
  const router = useRouter();
  const [signature, setSignature] = useState("");
  const [touched, setTouched] = useState(false);
  const [pending, startTransition] = useTransition();

  // Name must be at least 2 chars before acceptance is allowed.
  const canAccept = signature.trim().length >= 2;
  const showError = touched && !canAccept;

  const handleAccept = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
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
    <form
      onSubmit={handleAccept}
      className="bg-muted/30 space-y-4 rounded-lg border border-dashed p-6"
    >
      <div className="flex items-center justify-center gap-2">
        <span className="bg-warning-soft text-warning inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold">
          <span className="bg-warning size-1.5 animate-pulse rounded-full" />
          Awaiting signature
        </span>
      </div>

      <div className="flex items-center justify-center gap-2 text-sm font-semibold">
        <PenLine className="size-4" /> Accept &amp; sign
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signature">Signature</Label>
        <Input
          id="signature"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="Type your full name"
          aria-invalid={showError || undefined}
          className={cn(
            "rounded-none border-0 border-b bg-transparent px-0 text-lg italic shadow-none focus-visible:ring-0",
            showError && "border-destructive"
          )}
          required
        />
        {showError ? (
          <p className="text-destructive text-xs">Type your full name to sign.</p>
        ) : (
          <p className="text-muted-foreground text-center text-xs">
            Sign here to confirm
            {depositLabel
              ? ` — a ${depositPercent}% deposit (${depositLabel}) secures your dates`
              : ""}
            .
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Signing…" : "Accept & sign proposal"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={handleDecline}
          disabled={pending}
        >
          Decline
        </Button>
      </div>
    </form>
  );
}
