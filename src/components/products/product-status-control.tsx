"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select } from "@/components/ui/select";
import { setProductStatus } from "@/lib/actions/products";
import { PRODUCT_STATUSES, PRODUCT_STATUS_META } from "@/lib/domain";

export function ProductStatusControl({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (value: string) => {
    startTransition(async () => {
      const res = await setProductStatus(
        id,
        value as "draft" | "sent" | "accepted" | "rejected" | "expired"
      );
      if (res.ok) {
        toast.success(`Marked as ${PRODUCT_STATUS_META[value as keyof typeof PRODUCT_STATUS_META]?.label ?? value}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Select
      value={status}
      onChange={(e) => change(e.target.value)}
      disabled={pending}
      className="h-8 w-36"
      aria-label="Proposal status"
    >
      {PRODUCT_STATUSES.map((s) => (
        <option key={s} value={s}>
          {PRODUCT_STATUS_META[s].label}
        </option>
      ))}
    </Select>
  );
}
