"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  acceptProposalByToken,
  declineProposalByToken,
} from "@/lib/actions/proposals-public";
import { cn } from "@/lib/utils";

/**
 * Client-facing accept/e-sign card on the public proposal page. Typing your full
 * name is the signature; submitting records acceptance + signer audit data.
 * Presented as a designed "sign here" moment matching the marketing mockup.
 */
export function ProposalSignForm({
  token,
  defaultEmail,
  depositLabel,
}: {
  token: string;
  defaultEmail?: string | null;
  depositLabel?: string;
}) {
  const router = useRouter();
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState(defaultEmail ?? "");
  const [signature, setSignature] = useState("");
  const [errors, setErrors] = useState<{ name?: boolean; email?: boolean; sig?: boolean }>(
    {}
  );
  const [pending, startTransition] = useTransition();

  const validate = () => {
    const next = {
      name: signerName.trim().length < 2,
      email: !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(signerEmail.trim()),
      sig: signature.trim().length < 2,
    };
    setErrors(next);
    return !next.name && !next.email && !next.sig;
  };

  const handleAccept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    startTransition(async () => {
      const res = await acceptProposalByToken({
        token,
        signerName: signerName.trim(),
        signerEmail: signerEmail.trim(),
        signature: signature.trim(),
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="signerName">
            Full name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="signerName"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            onBlur={validate}
            placeholder="Jane Traveller"
            aria-invalid={errors.name || undefined}
            required
          />
          {errors.name && (
            <p className="text-destructive text-xs">Please enter your full name.</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signerEmail">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="signerEmail"
            type="email"
            value={signerEmail}
            onChange={(e) => setSignerEmail(e.target.value)}
            onBlur={validate}
            placeholder="you@example.com"
            aria-invalid={errors.email || undefined}
            required
          />
          {errors.email && (
            <p className="text-destructive text-xs">Enter a valid email address.</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signature">Signature</Label>
        <Input
          id="signature"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          onBlur={validate}
          placeholder="Type your full name"
          aria-invalid={errors.sig || undefined}
          className={cn(
            "rounded-none border-0 border-b bg-transparent px-0 text-lg italic shadow-none focus-visible:ring-0",
            errors.sig && "border-destructive"
          )}
          required
        />
        {errors.sig ? (
          <p className="text-destructive text-xs">Type your name to sign.</p>
        ) : (
          <p className="text-muted-foreground text-center text-xs">
            Sign here to confirm
            {depositLabel ? ` — a 50% deposit (${depositLabel}) secures your dates` : ""}
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
