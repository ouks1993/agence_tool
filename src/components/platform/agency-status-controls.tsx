"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reactivateAgency, suspendAgency } from "@/lib/actions/platform";

export function AgencyStatusControls({
  agencyId,
  status,
}: {
  agencyId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isActive = status === "active";

  const toggle = () => {
    startTransition(async () => {
      const res = isActive
        ? await suspendAgency(agencyId)
        : await reactivateAgency(agencyId);
      if (res.ok) {
        toast.success(isActive ? "Agency suspended" : "Agency reactivated");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Button
      variant={isActive ? "destructive" : "default"}
      size="sm"
      onClick={toggle}
      disabled={pending}
    >
      {isActive ? "Suspend" : "Reactivate"}
    </Button>
  );
}
