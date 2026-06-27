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
import {
  createOpportunity,
  updateOpportunity,
  type OpportunityInput,
} from "@/lib/actions/opportunities";
import {
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_META,
  SUPPORTED_CURRENCIES,
} from "@/lib/domain";
import type { ClientOption, TeamMember } from "@/lib/queries";

type FormState = {
  title: string;
  clientId: string;
  stage: string;
  value: string;
  currency: string;
  probability: string;
  destination: string;
  travelStartDate: string;
  travelEndDate: string;
  paxCount: string;
  expectedCloseDate: string;
  lostReason: string;
  notes: string;
  assignedToId: string;
};

export function OpportunityForm({
  mode,
  opportunityId,
  clients,
  teamMembers,
  initial,
}: {
  mode: "create" | "edit";
  opportunityId?: string;
  clients: ClientOption[];
  teamMembers: TeamMember[];
  initial?: Partial<FormState>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>({
    title: initial?.title ?? "",
    clientId: initial?.clientId ?? "",
    stage: initial?.stage ?? "lead",
    value: initial?.value ?? "",
    currency: initial?.currency ?? "DZD",
    probability: initial?.probability ?? "",
    destination: initial?.destination ?? "",
    travelStartDate: initial?.travelStartDate ?? "",
    travelEndDate: initial?.travelEndDate ?? "",
    paxCount: initial?.paxCount ?? "1",
    expectedCloseDate: initial?.expectedCloseDate ?? "",
    lostReason: initial?.lostReason ?? "",
    notes: initial?.notes ?? "",
    assignedToId: initial?.assignedToId ?? "",
  });

  const set = <K extends keyof FormState>(key: K, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: OpportunityInput = {
      title: form.title,
      clientId: form.clientId,
      stage: form.stage as OpportunityInput["stage"],
      value: form.value === "" ? 0 : Number(form.value),
      currency: form.currency,
      probability: form.probability === "" ? undefined : Number(form.probability),
      destination: form.destination,
      travelStartDate: form.travelStartDate,
      travelEndDate: form.travelEndDate,
      paxCount: form.paxCount === "" ? 1 : Number(form.paxCount),
      expectedCloseDate: form.expectedCloseDate,
      lostReason: form.lostReason,
      notes: form.notes,
      assignedToId: form.assignedToId,
    };
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createOpportunity(payload)
          : await updateOpportunity(opportunityId!, payload);
      if (res.ok) {
        toast.success(mode === "create" ? "Opportunity created" : "Saved");
        const id =
          mode === "create" && "data" in res ? res.data?.id : opportunityId;
        router.push(id ? `/opportunities/${id}` : "/opportunities");
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
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Honeymoon in the Maldives"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientId">Client *</Label>
            <Select
              id="clientId"
              value={form.clientId}
              onChange={(e) => set("clientId", e.target.value)}
              required
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage">Stage</Label>
            <Select
              id="stage"
              value={form.stage}
              onChange={(e) => set("stage", e.target.value)}
            >
              {OPPORTUNITY_STAGES.map((s) => (
                <option key={s} value={s}>
                  {OPPORTUNITY_STAGE_META[s].label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Estimated value</Label>
            <Input
              id="value"
              type="number"
              min="0"
              step="0.01"
              value={form.value}
              onChange={(e) => set("value", e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select
              id="currency"
              value={form.currency}
              onChange={(e) => set("currency", e.target.value)}
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="destination">Destination</Label>
            <Input
              id="destination"
              value={form.destination}
              onChange={(e) => set("destination", e.target.value)}
              placeholder="City / country"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paxCount">Travellers</Label>
            <Input
              id="paxCount"
              type="number"
              min="1"
              value={form.paxCount}
              onChange={(e) => set("paxCount", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="travelStartDate">Travel from</Label>
            <Input
              id="travelStartDate"
              type="date"
              value={form.travelStartDate}
              onChange={(e) => set("travelStartDate", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="travelEndDate">Travel to</Label>
            <Input
              id="travelEndDate"
              type="date"
              value={form.travelEndDate}
              onChange={(e) => set("travelEndDate", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expectedCloseDate">Expected close</Label>
            <Input
              id="expectedCloseDate"
              type="date"
              value={form.expectedCloseDate}
              onChange={(e) => set("expectedCloseDate", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignedToId">Assigned to</Label>
            <Select
              id="assignedToId"
              value={form.assignedToId}
              onChange={(e) => set("assignedToId", e.target.value)}
            >
              <option value="">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>

          {form.stage === "lost" && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="lostReason">Reason lost</Label>
              <Input
                id="lostReason"
                value={form.lostReason}
                onChange={(e) => set("lostReason", e.target.value)}
                placeholder="Price, timing, booked elsewhere…"
              />
            </div>
          )}

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : mode === "create"
              ? "Create opportunity"
              : "Save changes"}
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
