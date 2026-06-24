"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { inviteTeamMember, revokeInvite } from "@/lib/actions/invites";
import { USER_ROLE_META } from "@/lib/domain";
import type { UserRole } from "@/lib/domain";

/**
 * Email + role form for inviting a new team member. The list of assignable
 * roles is computed on the server (non-admins can't grant the admin role).
 */
export function TeamInviteForm({
  assignableRoles,
}: {
  assignableRoles: string[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(assignableRoles[0] ?? "agent");
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await inviteTeamMember(email, role);
      if (res.ok) {
        toast.success("Invite sent");
        setEmail("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
      <Input
        type="email"
        placeholder="teammate@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={pending}
        aria-label="Invite email"
        className="sm:flex-1"
      />
      <Select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        disabled={pending}
        aria-label="Invite role"
        className="sm:w-44"
      >
        {assignableRoles.map((r) => (
          <option key={r} value={r}>
            {USER_ROLE_META[r as UserRole].label}
          </option>
        ))}
      </Select>
      <Button type="submit" disabled={pending} className="gap-2">
        <Mail className="size-4" />
        Send invite
      </Button>
    </form>
  );
}

/**
 * A single pending-invite row: shows the email, builds the full accept link on
 * the client (so it uses the current origin), and exposes copy + revoke.
 */
export function PendingInviteRow({
  inviteId,
  token,
  email,
}: {
  inviteId: string;
  token: string;
  email: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const copyLink = async () => {
    // Build the link with the live origin so it works across environments.
    const link = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const revoke = () => {
    startTransition(async () => {
      const res = await revokeInvite(inviteId);
      if (res.ok) {
        toast.success("Invite revoked");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={copyLink}
        disabled={pending}
        className="gap-1.5"
        aria-label={`Copy invite link for ${email}`}
      >
        {copied ? (
          <Check className="size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
        Copy link
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={revoke}
        disabled={pending}
        aria-label={`Revoke invite for ${email}`}
      >
        Revoke
      </Button>
    </div>
  );
}
