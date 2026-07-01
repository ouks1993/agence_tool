"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Send, Check, AlertCircle, FileClock } from "lucide-react";
import { toast } from "sonner";
import { AiEmailDraftButton } from "@/components/bookings/ai-email-draft-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { sendBookingEmail } from "@/lib/actions/notifications";
import { formatDate } from "@/lib/format";

export type NotificationRow = {
  id: string;
  channel: string;
  recipient: string;
  subject: string | null;
  kind: string;
  status: string;
  createdAt: string | Date;
};

export function CommunicationsManager({
  bookingId,
  clientEmail,
  emailConfigured,
  notifications,
}: {
  bookingId: string;
  clientEmail: string | null;
  emailConfigured: boolean;
  notifications: NotificationRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    kind: "confirmation",
    to: clientEmail ?? "",
    subject: "",
    body: "",
  });

  const send = () => {
    startTransition(async () => {
      const res = await sendBookingEmail({
        bookingId,
        kind: form.kind as "confirmation" | "voucher" | "receipt" | "custom",
        toOverride: form.to,
        subject: form.subject,
        body: form.body,
      });
      if (res.ok) {
        toast.success(
          res.data?.status === "sent"
            ? "Email sent"
            : "Email logged (add SENDGRID_API_KEY to actually send)"
        );
        setForm({ kind: "confirmation", to: clientEmail ?? "", subject: "", body: "" });
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-3">
      {!emailConfigured && (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <FileClock className="size-3.5" /> Emails are logged only. Add SENDGRID_API_KEY +
          EMAIL_FROM to send for real.
        </p>
      )}

      {notifications.length === 0 ? (
        <p className="text-muted-foreground text-sm">No messages sent yet.</p>
      ) : (
        <ul className="divide-y">
          {notifications.map((n) => (
            <li key={n.id} className="flex items-start gap-3 py-2.5">
              <Mail className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{n.subject ?? n.kind}</p>
                <p className="text-muted-foreground text-xs">
                  {n.recipient} · {formatDate(n.createdAt)}
                </p>
              </div>
              <StatusPill status={n.status} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <AiEmailDraftButton
          bookingId={bookingId}
          onDraft={(subject, body) => {
            // A custom kind makes the subject/body fields visible in the compose form.
            setForm((f) => ({ ...f, kind: "custom", subject, body }));
            setOpen(true);
          }}
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Send className="mr-2 size-4" />
              Send email
            </Button>
          </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send email to client</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="n-kind">Template</Label>
              <Select
                id="n-kind"
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
              >
                <option value="confirmation">Booking confirmation</option>
                <option value="voucher">Travel voucher</option>
                <option value="receipt">Payment receipt</option>
                <option value="custom">Custom message</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n-to">To</Label>
              <Input
                id="n-to"
                type="email"
                value={form.to}
                onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
                placeholder="client@example.com"
              />
            </div>
            {form.kind === "custom" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="n-subject">Subject</Label>
                  <Input
                    id="n-subject"
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="n-body">Message</Label>
                  <Textarea
                    id="n-body"
                    rows={5}
                    value={form.body}
                    onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={send} disabled={pending || !form.to}>
              {pending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-danger">
        <AlertCircle className="size-3.5" /> Failed
      </span>
    );
  }
  if (status === "sent") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success">
        <Check className="size-3.5" /> Sent
      </span>
    );
  }
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
      <FileClock className="size-3.5" /> Logged
    </span>
  );
}
