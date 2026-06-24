"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAgency } from "@/lib/actions/platform";

export function CreateAgencyForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", adminName: "", adminEmail: "" });
  // Once an agency is provisioned we swap the form for the invite link panel.
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Built on the client so it always reflects the current origin (no env needed).
  const inviteLink = inviteToken
    ? `${window.location.origin}/invite/${inviteToken}`
    : "";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createAgency({
        name: form.name,
        adminEmail: form.adminEmail,
        ...(form.adminName ? { adminName: form.adminName } : {}),
      });
      if (res.ok && res.inviteToken) {
        setInviteToken(res.inviteToken);
        toast.success("Agency created");
        // Refresh so the new agency shows up if the user navigates back.
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to create the agency.");
      }
    });
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success("Invite link copied");
    // Reset the copied indicator after a short delay.
    setTimeout(() => setCopied(false), 2000);
  };

  if (inviteToken) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="font-medium">Agency created</p>
          <p className="text-muted-foreground text-sm">
            Send this link to the agency admin to set up their account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input value={inviteLink} readOnly className="font-mono text-xs" />
          <Button type="button" variant="outline" size="icon" onClick={copyLink}>
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
            <span className="sr-only">Copy invite link</span>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => router.push("/platform")}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Agency name *</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Acme Travel"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="adminName">Admin name</Label>
        <Input
          id="adminName"
          value={form.adminName}
          onChange={(e) => set("adminName", e.target.value)}
          placeholder="Jane Doe"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="adminEmail">Admin email *</Label>
        <Input
          id="adminEmail"
          type="email"
          value={form.adminEmail}
          onChange={(e) => set("adminEmail", e.target.value)}
          placeholder="admin@acmetravel.com"
          required
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create agency"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/platform")}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
