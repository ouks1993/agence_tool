"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  acceptProposalByToken,
  declineProposalByToken,
} from "@/lib/actions/proposals-public";

/**
 * Client-facing accept/e-sign form on the public proposal page. Typing your full
 * name is the signature; submitting records acceptance + signer audit data.
 */
export function ProposalSignForm({
  token,
  defaultEmail,
}: {
  token: string;
  defaultEmail?: string | null;
}) {
  const router = useRouter();
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState(defaultEmail ?? "");
  const [signature, setSignature] = useState("");
  const [pending, startTransition] = useTransition();

  const handleAccept = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await acceptProposalByToken({
        token,
        signerName,
        signerEmail,
        signature,
      });
      if (res.ok) {
        toast.success("Proposal accepted. Thank you!");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not accept the proposal.");
      }
    });
  };

  const handleDecline = () => {
    startTransition(async () => {
      const res = await declineProposalByToken(token);
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="signerName">Full name</Label>
          <Input
            id="signerName"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="Jane Traveller"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signerEmail">Email</Label>
          <Input
            id="signerEmail"
            type="email"
            value={signerEmail}
            onChange={(e) => setSignerEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="signature">Signature (type your full name)</Label>
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
        <Button type="submit" disabled={pending}>
          <Check className="mr-1 size-4" /> Accept &amp; sign
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
