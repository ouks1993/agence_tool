"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAgencyDepositPercent } from "@/lib/actions/settings";

/**
 * Edits the agency's deposit percentage — the share of a booking total the
 * client must pay to confirm a booking, and the deposit figure shown on client
 * proposals. Admin/manager only (gated server-side too). On success the page is
 * refreshed so the persisted value re-renders.
 */
export function DepositPercentForm({ depositPercent }: { depositPercent: number }) {
  const router = useRouter();
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [value, setValue] = useState(String(depositPercent));
  const [pending, startTransition] = useTransition();

  const parsed = Number(value);
  const valid = Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
  const unchanged = valid && parsed === depositPercent;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) {
      toast.error(t("depositRange"));
      return;
    }
    startTransition(async () => {
      const res = await updateAgencyDepositPercent({ depositPercent: parsed });
      if (res.ok) {
        toast.success(t("saved"));
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="deposit-percent">{t("depositPercent")}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="deposit-percent"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={0.5}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
            aria-invalid={!valid || undefined}
            className="w-28 tabular-nums"
            required
          />
          <span className="text-muted-foreground text-sm">%</span>
        </div>
        <p className="text-muted-foreground text-xs">{t("depositPercentHint")}</p>
      </div>
      <Button type="submit" disabled={pending || unchanged || !valid}>
        {tCommon("save")}
      </Button>
    </form>
  );
}
