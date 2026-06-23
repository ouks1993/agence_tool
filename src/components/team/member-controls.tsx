"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { setUserRole, setUserActive } from "@/lib/actions/team";

export function MemberControls({
  userId,
  role,
  active,
  isSelf,
}: {
  userId: string;
  role: string;
  active: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const changeRole = (value: string) => {
    startTransition(async () => {
      const res = await setUserRole(userId, value as "manager" | "agent");
      if (res.ok) {
        toast.success("Role updated");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const toggleActive = () => {
    startTransition(async () => {
      const res = await setUserActive(userId, !active);
      if (res.ok) {
        toast.success(active ? "Member deactivated" : "Member activated");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <Select
        value={role}
        onChange={(e) => changeRole(e.target.value)}
        disabled={pending}
        className="h-8 w-32"
        aria-label="Role"
      >
        <option value="agent">Agent</option>
        <option value="manager">Manager</option>
      </Select>
      <Button
        variant={active ? "outline" : "secondary"}
        size="sm"
        onClick={toggleActive}
        disabled={pending || isSelf}
        title={isSelf ? "You can't deactivate yourself" : undefined}
      >
        {active ? "Deactivate" : "Activate"}
      </Button>
    </div>
  );
}
