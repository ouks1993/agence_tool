"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { draftEmail } from "@/lib/actions/ai";

type DraftKind = "confirmation" | "voucher" | "followup" | "custom";

const KIND_OPTIONS: Array<{ value: DraftKind; label: string }> = [
  { value: "confirmation", label: "Confirmation" },
  { value: "voucher", label: "Voucher email" },
  { value: "followup", label: "Follow-up" },
  { value: "custom", label: "Custom" },
];

/**
 * Opens a dialog that drafts a client email with AI. When the agent accepts a
 * draft, it is lifted into the parent compose form via the `onDraft` callback.
 */
export function AiEmailDraftButton({
  bookingId,
  onDraft,
}: {
  bookingId: string;
  onDraft?: (subject: string, body: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<DraftKind>("confirmation");
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);

  const reset = () => {
    setKind("confirmation");
    setInstruction("");
    setError(null);
    setDraft(null);
  };

  const generate = () => {
    setError(null);
    startTransition(async () => {
      const res = await draftEmail(
        bookingId,
        kind,
        kind === "custom" ? instruction : undefined
      );
      if (res.ok && res.data) {
        setDraft({ subject: res.data.subject, body: res.data.body });
      } else if (!res.ok) {
        setError(res.error);
      }
    });
  };

  const use = () => {
    if (draft) onDraft?.(draft.subject, draft.body);
    setOpen(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="mr-2 size-4" />
          Draft with AI
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Draft email with AI</DialogTitle>
          <DialogDescription>
            AI-generated. Review and edit before sending — content may be inaccurate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ai-kind">Type</Label>
            <Select
              id="ai-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as DraftKind)}
              disabled={pending}
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>

          {kind === "custom" && (
            <div className="space-y-1.5">
              <Label htmlFor="ai-instruction">Instruction</Label>
              <Textarea
                id="ai-instruction"
                rows={3}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="e.g. Remind the client to send their visa photos by Friday."
                disabled={pending}
              />
            </div>
          )}

          {draft && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="ai-subject">Subject</Label>
                <Textarea
                  id="ai-subject"
                  rows={2}
                  value={draft.subject}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, subject: e.target.value } : d))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-body">Body</Label>
                <Textarea
                  id="ai-body"
                  rows={8}
                  value={draft.body}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, body: e.target.value } : d))
                  }
                />
              </div>
            </>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => generate()}
            disabled={pending || (kind === "custom" && !instruction.trim())}
          >
            {pending ? "Generating…" : draft ? "Regenerate" : "Generate draft"}
          </Button>
          <Button onClick={use} disabled={!draft || pending}>
            Use this draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
