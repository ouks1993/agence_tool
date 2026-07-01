"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CityInput } from "@/components/reference/city-input";
import { CountryCombobox } from "@/components/reference/country-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createSupplier,
  updateSupplier,
  type SupplierInput,
} from "@/lib/actions/suppliers";
import {
  SUPPLIER_STATUSES,
  SUPPLIER_STATUS_META,
  SUPPLIER_TYPES,
  SUPPLIER_TYPE_META,
} from "@/lib/domain";

type Props = {
  mode: "create" | "edit";
  supplierId?: string;
  defaultValues?: Partial<SupplierInput>;
};

type FieldErrors = Partial<Record<"name" | "email" | "website", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SupplierForm({ mode, supplierId, defaultValues }: Props) {
  const router = useRouter();
  const t = useTranslations("suppliers.form");
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<SupplierInput>({
    name: defaultValues?.name ?? "",
    type: (defaultValues?.type as SupplierInput["type"]) ?? "hotel",
    status: (defaultValues?.status as SupplierInput["status"]) ?? "active",
    email: defaultValues?.email ?? "",
    phone: defaultValues?.phone ?? "",
    website: defaultValues?.website ?? "",
    contactName: defaultValues?.contactName ?? "",
    address: defaultValues?.address ?? "",
    city: defaultValues?.city ?? "",
    country: defaultValues?.country ?? "",
    notes: defaultValues?.notes ?? "",
  });

  const set = <K extends keyof SupplierInput>(key: K, value: SupplierInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Clear a single field error (delete the key rather than set undefined, to
  // satisfy exactOptionalPropertyTypes).
  const clearError = (key: keyof FieldErrors) =>
    setErrors((x) => {
      if (!x[key]) return x;
      const { [key]: _omit, ...rest } = x;
      return rest;
    });

  // Lightweight client-side validation — format checks that mirror the server
  // Zod schema, surfaced inline before the round-trip.
  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!form.name.trim()) next.name = t("required");
    if (form.email && !EMAIL_RE.test(form.email.trim()))
      next.email = t("emailInvalid");
    if (form.website && form.website.trim()) {
      try {
        // Accept bare domains by prefixing a scheme for the URL constructor.
        new URL(
          /^https?:\/\//i.test(form.website.trim())
            ? form.website.trim()
            : `https://${form.website.trim()}`
        );
      } catch {
        next.website = t("websiteInvalid");
      }
    }
    return next;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    startTransition(async () => {
      const res =
        mode === "create"
          ? await createSupplier(form)
          : await updateSupplier(supplierId!, form);
      if (res.ok) {
        toast.success(mode === "create" ? t("created") : t("updated"));
        const id = mode === "create" && "data" in res ? res.data?.id : supplierId;
        router.push(id ? `/suppliers/${id}` : "/suppliers");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card className="card-elevated">
        <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="name">{t("name")} *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => {
                set("name", e.target.value);
                clearError("name");
              }}
              placeholder={t("namePlaceholder")}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? "name-error" : undefined}
              required
            />
            {errors.name && (
              <p id="name-error" className="text-destructive text-xs">
                {errors.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">{t("type")}</Label>
            <Select
              id="type"
              value={form.type}
              onChange={(e) => set("type", e.target.value as SupplierInput["type"])}
            >
              {SUPPLIER_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {SUPPLIER_TYPE_META[ty].label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">{t("status")}</Label>
            <Select
              id="status"
              value={form.status}
              onChange={(e) => set("status", e.target.value as SupplierInput["status"])}
            >
              {SUPPLIER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {SUPPLIER_STATUS_META[s].label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => {
                set("email", e.target.value);
                clearError("email");
              }}
              placeholder={t("emailPlaceholder")}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
            {errors.email && (
              <p id="email-error" className="text-destructive text-xs">
                {errors.email}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{t("phone")}</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+33 1 23 45 67 89"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">{t("website")}</Label>
            <Input
              id="website"
              value={form.website}
              onChange={(e) => {
                set("website", e.target.value);
                clearError("website");
              }}
              placeholder={t("websitePlaceholder")}
              aria-invalid={errors.website ? true : undefined}
              aria-describedby={
                errors.website ? "website-error" : "website-hint"
              }
            />
            {errors.website ? (
              <p id="website-error" className="text-destructive text-xs">
                {errors.website}
              </p>
            ) : (
              <p id="website-hint" className="text-muted-foreground text-xs">
                {t("websiteHint")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactName">{t("contactName")}</Label>
            <Input
              id="contactName"
              value={form.contactName}
              onChange={(e) => set("contactName", e.target.value)}
              placeholder={t("contactPlaceholder")}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">{t("address")}</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">{t("city")}</Label>
            <CityInput id="city" value={form.city ?? ""} onChange={(v) => set("city", v)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">{t("country")}</Label>
            <CountryCombobox id="country" value={form.country ?? ""} onChange={(v) => set("country", v)} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">{t("notes")}</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={4}
              placeholder={t("notesPlaceholder")}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : mode === "create" ? t("create") : t("save")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={pending}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
