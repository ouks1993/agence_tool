"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/lib/actions/settings";

/**
 * Edits the signed-in user's display name. Email is shown read-only since it is
 * the account identity and not editable here. On success the page is refreshed
 * so server-rendered name displays pick up the new value.
 */
export function ProfileForm({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateProfile({ name: value });
      if (res.ok) {
        toast.success(t("saved"));
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const trimmed = value.trim();
  const unchanged = trimmed === name;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="profile-name">{t("name")}</Label>
        <Input
          id="profile-name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={pending}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="profile-email">{t("email")}</Label>
        <Input id="profile-email" type="email" value={email} disabled readOnly />
      </div>
      <Button type="submit" disabled={pending || unchanged || trimmed.length === 0}>
        {tCommon("save")}
      </Button>
    </form>
  );
}
