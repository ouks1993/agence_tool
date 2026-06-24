"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { setUserRole, setUserActive } from "@/lib/actions/team";
import { USER_ROLE_META } from "@/lib/domain";
import type { UserRole } from "@/lib/domain";

export function MemberControls({
  userId,
  role,
  active,
  isSelf,
  assignableRoles,
}: {
  userId: string;
  role: string;
  active: boolean;
  isSelf: boolean;
  assignableRoles: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const changeRole = (value: string) => {
    startTransition(async () => {
      const res = await setUserRole(userId, value as UserRole);
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
        className="h-8 w-36"
        aria-label="Role"
      >
        {assignableRoles.map((r) => (
          <option key={r} value={r}>
            {USER_ROLE_META[r as UserRole].label}
          </option>
        ))}
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
