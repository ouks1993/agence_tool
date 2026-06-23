"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient, updateClient, type ClientInput } from "@/lib/actions/clients";
import type { TeamMember } from "@/lib/queries";

type Props = {
  mode: "create" | "edit";
  clientId?: string;
  teamMembers: TeamMember[];
  initial?: Partial<ClientInput>;
};

export function ClientForm({ mode, clientId, teamMembers, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<ClientInput>({
    name: initial?.name ?? "",
    type: (initial?.type as ClientInput["type"]) ?? "individual",
    status: (initial?.status as ClientInput["status"]) ?? "active",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    company: initial?.company ?? "",
    address: initial?.address ?? "",
    city: initial?.city ?? "",
    country: initial?.country ?? "",
    source: initial?.source ?? "",
    notes: initial?.notes ?? "",
    ownerId: initial?.ownerId ?? "",
  });

  const set = <K extends keyof ClientInput>(key: K, value: ClientInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createClient(form)
          : await updateClient(clientId!, form);
      if (res.ok) {
        toast.success(mode === "create" ? "Client created" : "Client updated");
        const id = mode === "create" && "data" in res ? res.data?.id : clientId;
        router.push(id ? `/clients/${id}` : "/clients");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Full name or account name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select
              id="type"
              value={form.type}
              onChange={(e) => set("type", e.target.value as ClientInput["type"])}
            >
              <option value="individual">Individual</option>
              <option value="corporate">Corporate</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              value={form.status}
              onChange={(e) => set("status", e.target.value as ClientInput["status"])}
            >
              <option value="lead">Lead</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="name@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+33 6 12 34 56 78"
            />
          </div>

          {form.type === "corporate" && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={form.company}
                onChange={(e) => set("company", e.target.value)}
                placeholder="Company / organisation name"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Input
              id="source"
              value={form.source}
              onChange={(e) => set("source", e.target.value)}
              placeholder="Referral, website, walk-in…"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerId">Owner</Label>
            <Select
              id="ownerId"
              value={form.ownerId}
              onChange={(e) => set("ownerId", e.target.value)}
            >
              <option value="">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={4}
              placeholder="Preferences, special requirements, history…"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create client" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
