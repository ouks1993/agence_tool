"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createProduct, updateProduct, type ProductInput } from "@/lib/actions/products";
import { SUPPORTED_CURRENCIES } from "@/lib/domain";
import type { ClientOption, OpportunityOption } from "@/lib/queries";

type FormState = {
  title: string;
  clientId: string;
  opportunityId: string;
  destination: string;
  startDate: string;
  endDate: string;
  paxCount: string;
  currency: string;
  markupPercent: string;
  validUntil: string;
  summary: string;
};

export function ProductForm({
  mode,
  productId,
  clients,
  opportunities,
  initial,
}: {
  mode: "create" | "edit";
  productId?: string;
  clients: ClientOption[];
  opportunities: OpportunityOption[];
  initial?: Partial<FormState>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>({
    title: initial?.title ?? "",
    clientId: initial?.clientId ?? "",
    opportunityId: initial?.opportunityId ?? "",
    destination: initial?.destination ?? "",
    startDate: initial?.startDate ?? "",
    endDate: initial?.endDate ?? "",
    paxCount: initial?.paxCount ?? "1",
    currency: initial?.currency ?? "DZD",
    markupPercent: initial?.markupPercent ?? "0",
    validUntil: initial?.validUntil ?? "",
    summary: initial?.summary ?? "",
  });

  const [dateError, setDateError] = useState(false);

  const set = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  // End date must not precede start date.
  const invalidRange =
    !!form.startDate && !!form.endDate && form.endDate < form.startDate;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invalidRange) {
      setDateError(true);
      toast.error("End date can't be before the start date.");
      return;
    }
    const payload: ProductInput = {
      title: form.title,
      clientId: form.clientId || undefined,
      opportunityId: form.opportunityId || undefined,
      destination: form.destination,
      startDate: form.startDate,
      endDate: form.endDate,
      paxCount: form.paxCount === "" ? 1 : Number(form.paxCount),
      currency: form.currency,
      markupPercent: form.markupPercent === "" ? 0 : Number(form.markupPercent),
      validUntil: form.validUntil,
      summary: form.summary,
    };
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createProduct(payload)
          : await updateProduct(productId!, payload);
      if (res.ok) {
        toast.success(mode === "create" ? "Proposal created" : "Saved");
        const id = mode === "create" && "data" in res ? res.data?.id : productId;
        router.push(id ? `/proposals/${id}` : "/proposals");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-base">Trip details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. 7 nights in Marrakech — Benali family"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientId">Client</Label>
            <Select
              id="clientId"
              value={form.clientId}
              onChange={(e) => set("clientId", e.target.value)}
            >
              <option value="">No client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="opportunityId">Opportunity</Label>
            <Select
              id="opportunityId"
              value={form.opportunityId}
              onChange={(e) => set("opportunityId", e.target.value)}
            >
              <option value="">None</option>
              {opportunities.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
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
            <Label htmlFor="startDate">Start date</Label>
            <Input
              id="startDate"
              type="date"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">End date</Label>
            <Input
              id="endDate"
              type="date"
              min={form.startDate || undefined}
              value={form.endDate}
              onChange={(e) => {
                set("endDate", e.target.value);
                if (dateError) setDateError(false);
              }}
              aria-invalid={(dateError && invalidRange) || undefined}
            />
            {dateError && invalidRange && (
              <p className="text-destructive text-xs">
                End date can&apos;t be before the start date.
              </p>
            )}
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
            <Label htmlFor="markupPercent">Margin %</Label>
            <Input
              id="markupPercent"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={form.markupPercent}
              onChange={(e) => set("markupPercent", e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Agency margin added on top of net supplier cost.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="validUntil">Valid until</Label>
            <Input
              id="validUntil"
              type="date"
              value={form.validUntil}
              onChange={(e) => set("validUntil", e.target.value)}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="summary">Proposal summary</Label>
            <Textarea
              id="summary"
              value={form.summary}
              onChange={(e) => set("summary", e.target.value)}
              rows={5}
              placeholder="Client-facing description of the trip. The AI Assistant can draft this for you."
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create proposal" : "Save changes"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
