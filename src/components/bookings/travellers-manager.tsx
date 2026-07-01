"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Star,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { CountryCombobox } from "@/components/reference/country-combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  addTraveller,
  updateTraveller,
  removeTraveller,
  type TravellerInput,
} from "@/lib/actions/bookings";
import { GENDERS, GENDER_LABEL, TITLES, TITLE_LABEL } from "@/lib/domain";
import { formatDate, toDateInputValue, passportExpiryStatus } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Traveller = {
  id: string;
  fullName: string;
  title: string | null;
  gender: string | null;
  passportNumber: string | null;
  passportExpiry: string | Date | null;
  nationality: string | null;
  dateOfBirth: string | Date | null;
  passportIssueDate: string | Date | null;
  passportIssuePlace: string | null;
  isLead: boolean;
};

type FormState = {
  fullName: string;
  title: string;
  gender: string;
  passportNumber: string;
  passportExpiry: string;
  nationality: string;
  dateOfBirth: string;
  passportIssueDate: string;
  passportIssuePlace: string;
};

const empty: FormState = {
  fullName: "",
  title: "",
  gender: "",
  passportNumber: "",
  passportExpiry: "",
  nationality: "",
  dateOfBirth: "",
  passportIssueDate: "",
  passportIssuePlace: "",
};

export function TravellersManager({
  bookingId,
  travellers,
  travelDate,
}: {
  bookingId: string;
  travellers: Traveller[];
  travelDate: string | Date | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(empty);

  const openAdd = () => {
    setEditingId(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (t: Traveller) => {
    setEditingId(t.id);
    setForm({
      fullName: t.fullName,
      title: t.title ?? "",
      gender: t.gender ?? "",
      passportNumber: t.passportNumber ?? "",
      passportExpiry: toDateInputValue(t.passportExpiry),
      nationality: t.nationality ?? "",
      dateOfBirth: toDateInputValue(t.dateOfBirth),
      passportIssueDate: toDateInputValue(t.passportIssueDate),
      passportIssuePlace: t.passportIssuePlace ?? "",
    });
    setOpen(true);
  };

  const save = () => {
    startTransition(async () => {
      const payload = form as TravellerInput;
      const res = editingId
        ? await updateTraveller(editingId, bookingId, payload)
        : await addTraveller(bookingId, payload);
      if (res.ok) {
        toast.success(editingId ? "Traveller updated" : "Traveller added");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const res = await removeTraveller(id, bookingId);
      if (res.ok) {
        toast.success("Traveller removed");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-3">
      {travellers.length === 0 ? (
        <p className="text-muted-foreground text-sm">No travellers yet.</p>
      ) : (
        <ul className="divide-y">
          {travellers.map((t) => {
            const status = passportExpiryStatus(t.passportExpiry, travelDate);
            return (
              <li key={t.id} className="flex items-start gap-3 py-3">
                <div className="bg-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
                  <User className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-medium">
                    {t.fullName}
                    {t.isLead && (
                      <Star className="size-3.5 fill-amber-400 text-amber-400" />
                    )}
                  </p>
                  <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    {t.nationality && <span>{t.nationality}</span>}
                    {t.passportNumber && <span>Passport {t.passportNumber}</span>}
                    {t.dateOfBirth && <span>DOB {formatDate(t.dateOfBirth)}</span>}
                  </div>
                  <PassportBadge status={status} />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(t)}
                  disabled={pending}
                  aria-label={`Edit ${t.fullName}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(t.id)}
                  disabled={pending}
                  aria-label={`Remove ${t.fullName}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Button variant="outline" size="sm" onClick={openAdd}>
        <Plus className="mr-2 size-4" />
        Add traveller
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit traveller" : "Add traveller"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="t-name">Full name *</Label>
              <Input
                id="t-name"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder="As printed on passport"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-title">Title</Label>
              <Select
                id="t-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              >
                <option value="">Not set</option>
                {TITLES.map((t) => (
                  <option key={t} value={t}>
                    {TITLE_LABEL[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-gender">Gender</Label>
              <Select
                id="t-gender"
                value={form.gender}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
              >
                <option value="">Not set</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {GENDER_LABEL[g]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-nat">Nationality</Label>
              <CountryCombobox
                id="t-nat"
                mode="nationality"
                value={form.nationality}
                onChange={(v) => setForm((f) => ({ ...f, nationality: v }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-dob">Date of birth</Label>
              <Input
                id="t-dob"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-pass">Passport number</Label>
              <Input
                id="t-pass"
                value={form.passportNumber}
                onChange={(e) => setForm((f) => ({ ...f, passportNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-exp">Passport expiry</Label>
              <Input
                id="t-exp"
                type="date"
                value={form.passportExpiry}
                onChange={(e) => setForm((f) => ({ ...f, passportExpiry: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-iss">Issue date</Label>
              <Input
                id="t-iss"
                type="date"
                value={form.passportIssueDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, passportIssueDate: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-place">Place of issue</Label>
              <Input
                id="t-place"
                value={form.passportIssuePlace}
                onChange={(e) =>
                  setForm((f) => ({ ...f, passportIssuePlace: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending || !form.fullName}>
              {pending ? "Saving…" : editingId ? "Save" : "Add traveller"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PassportBadge({
  status,
}: {
  status: ReturnType<typeof passportExpiryStatus>;
}) {
  if (status.level === "unknown") {
    return (
      <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
        <ShieldAlert className="size-3.5" /> {status.message}
      </p>
    );
  }
  const map = {
    ok: { icon: ShieldCheck, cls: "text-success" },
    warning: { icon: ShieldAlert, cls: "text-warning" },
    expired: { icon: ShieldX, cls: "text-danger" },
  } as const;
  const { icon: Icon, cls } = map[status.level];
  return (
    <p className={cn("mt-1 flex items-center gap-1 text-xs font-medium", cls)}>
      <Icon className="size-3.5" /> {status.message}
    </p>
  );
}
