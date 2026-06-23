"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Mail, Phone, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addContact, deleteContact } from "@/lib/actions/clients";

export type Contact = {
  id: string;
  name: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
};

export function ContactsManager({
  clientId,
  contacts,
}: {
  clientId: string;
  contacts: Contact[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    jobTitle: "",
    email: "",
    phone: "",
    isPrimary: false,
  });

  const reset = () =>
    setForm({ name: "", jobTitle: "", email: "", phone: "", isPrimary: false });

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await addContact({ clientId, ...form });
      if (res.ok) {
        toast.success("Contact added");
        reset();
        setAdding(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const onDelete = (contactId: string) => {
    startTransition(async () => {
      const res = await deleteContact(contactId, clientId);
      if (res.ok) {
        toast.success("Contact removed");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-3">
      {contacts.length === 0 && !adding && (
        <p className="text-muted-foreground text-sm">No contacts yet.</p>
      )}

      <ul className="divide-y">
        {contacts.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0 space-y-0.5">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                {c.name}
                {c.isPrimary && (
                  <Star className="size-3.5 fill-amber-400 text-amber-400" />
                )}
              </p>
              {c.jobTitle && (
                <p className="text-muted-foreground text-xs">{c.jobTitle}</p>
              )}
              <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                {c.email && (
                  <a
                    href={`mailto:${c.email}`}
                    className="flex items-center gap-1 hover:underline"
                  >
                    <Mail className="size-3" /> {c.email}
                  </a>
                )}
                {c.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="size-3" /> {c.phone}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(c.id)}
              disabled={pending}
              aria-label={`Remove ${c.name}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      {adding ? (
        <form onSubmit={onAdd} className="bg-muted/40 space-y-3 rounded-md border p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Name *</Label>
              <Input
                id="c-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-title">Job title</Label>
              <Input
                id="c-title"
                value={form.jobTitle}
                onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email">Email</Label>
              <Input
                id="c-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">Phone</Label>
              <Input
                id="c-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isPrimary}
              onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))}
              className="size-4 rounded border-input"
            />
            Primary contact
          </label>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending || !form.name}>
              {pending ? "Adding…" : "Add contact"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                reset();
                setAdding(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-2 size-4" />
          Add contact
        </Button>
      )}
    </div>
  );
}
