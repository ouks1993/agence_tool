"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgePercent, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/app/status-badge";
import { RecordCommissionDialog } from "@/components/commissions/record-commission-dialog";
import { Button } from "@/components/ui/button";
import {
  updateCommissionStatus,
  voidCommission,
} from "@/lib/actions/commissions";
import {
  COMMISSION_STATUS_META,
  COMMISSION_TYPE_LABEL,
  type CommissionStatus,
  type CommissionType,
} from "@/lib/domain";
import { formatMoney } from "@/lib/format";

/**
 * Shape of a single commission row as returned by the commission actions.
 * Kept loose (string unions widened) so it tolerates the server payload.
 */
export type CommissionRow = {
  id: string;
  type: string;
  status: string;
  amount: string;
  currency: string;
  supplierName: string | null;
  agentName: string | null;
};

/** A commission can move forward depending on its current status. */
function nextActions(status: string): {
  earn: boolean;
  pay: boolean;
  canVoid: boolean;
} {
  return {
    earn: status === "pending",
    pay: status === "invoiced" || status === "earned",
    canVoid: status !== "paid" && status !== "void",
  };
}

export function CommissionsManager({
  commissions,
  bookingId = null,
}: {
  commissions: CommissionRow[];
  /** When rendered inside a booking workspace, new commissions attach to it. */
  bookingId?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const setStatus = (id: string, status: CommissionStatus) => {
    startTransition(async () => {
      const res = await updateCommissionStatus(id, status);
      if (res.ok) {
        toast.success(`Marked ${COMMISSION_STATUS_META[status].label.toLowerCase()}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const res = await voidCommission(id);
      if (res.ok) {
        toast.success("Commission voided");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-3">
      {commissions.length === 0 ? (
        <p className="text-muted-foreground text-sm">No commissions yet.</p>
      ) : (
        <ul className="divide-y">
          {commissions.map((c) => {
            const statusMeta =
              COMMISSION_STATUS_META[c.status as CommissionStatus];
            const typeLabel =
              COMMISSION_TYPE_LABEL[c.type as CommissionType] ?? c.type;
            // Who the commission is with depends on its direction.
            const party =
              c.type === "supplier_to_agency" ? c.supplierName : c.agentName;
            const actions = nextActions(c.status);
            return (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5"
              >
                <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
                  <BadgePercent className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {formatMoney(c.amount, c.currency)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {typeLabel}
                    {party ? ` · ${party}` : ""}
                  </p>
                </div>
                <StatusBadge
                  label={statusMeta?.label ?? c.status}
                  tone={statusMeta?.className}
                />
                {actions.earn && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setStatus(c.id, "earned")}
                    disabled={pending}
                  >
                    Mark earned
                  </Button>
                )}
                {actions.pay && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setStatus(c.id, "paid")}
                    disabled={pending}
                  >
                    Mark paid
                  </Button>
                )}
                {actions.canVoid && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(c.id)}
                    disabled={pending}
                    aria-label="Void commission"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <RecordCommissionDialog
        bookingId={bookingId}
        trigger={
          <Button variant="outline" size="sm">
            <BadgePercent className="mr-2 size-4" />
            Add commission
          </Button>
        }
      />
    </div>
  );
}
