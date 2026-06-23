"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { addItemToProposal, type ItemInput } from "@/lib/actions/products";

export type DraftOption = { id: string; label: string };
export type ClientOption = { id: string; name: string };

export function AddToProposalDialog({
  item,
  itemSummary,
  drafts,
  clients,
}: {
  item: ItemInput;
  itemSummary: string;
  drafts: DraftOption[];
  clients: ClientOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"existing" | "new">(
    drafts.length ? "existing" : "new"
  );
  const [draftId, setDraftId] = useState(drafts[0]?.id ?? "");
  const [newTitle, setNewTitle] = useState(item.title);
  const [clientId, setClientId] = useState("");

  const submit = () => {
    startTransition(async () => {
      const res = await addItemToProposal(
        mode === "existing"
          ? { productId: draftId, item }
          : { newProductTitle: newTitle, clientId: clientId || undefined, item }
      );
      if (res.ok && res.data) {
        toast.success("Added to proposal", {
          action: {
            label: "Open",
            onClick: () => router.push(`/products/${res.data!.productId}`),
          },
        });
        setOpen(false);
        router.refresh();
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Plus className="mr-1 size-4" />
          Add to proposal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to proposal</DialogTitle>
          <DialogDescription>{itemSummary}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "existing" ? "default" : "outline"}
              onClick={() => setMode("existing")}
              disabled={drafts.length === 0}
            >
              Existing draft
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "new" ? "default" : "outline"}
              onClick={() => setMode("new")}
            >
              New proposal
            </Button>
          </div>

          {mode === "existing" ? (
            <div className="space-y-2">
              <Label htmlFor="draft">Draft proposal</Label>
              <Select
                id="draft"
                value={draftId}
                onChange={(e) => setDraftId(e.target.value)}
              >
                {drafts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="newTitle">Proposal title</Label>
                <Input
                  id="newTitle"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client">Client (optional)</Label>
                <Select
                  id="client"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">No client yet</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={pending || (mode === "existing" && !draftId)}
          >
            {pending ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
