import {
  OPPORTUNITY_STAGE_META,
  PRODUCT_STATUS_META,
  type OpportunityStage,
  type ProductStatus,
} from "@/lib/domain";

export type ActivityRow = {
  action: string;
  entityType: string;
  entityLabel: string | null;
  metadata: unknown;
};

const VERB: Record<string, string> = {
  created: "created",
  updated: "updated",
  deleted: "deleted",
  sent: "sent",
  stage_changed: "moved",
  status_changed: "updated the status of",
};

/** Turns an activity log row into a human-readable sentence. */
export function describeActivity(a: ActivityRow): string {
  const label = a.entityLabel ?? "an item";
  const entity = a.entityType;

  if (a.action === "stage_changed") {
    const meta = a.metadata as { from?: string; to?: string } | null;
    const from = meta?.from
      ? (OPPORTUNITY_STAGE_META[meta.from as OpportunityStage]?.label ?? meta.from)
      : null;
    const to = meta?.to
      ? (OPPORTUNITY_STAGE_META[meta.to as OpportunityStage]?.label ?? meta.to)
      : null;
    if (from && to) return `moved ${entity} “${label}” from ${from} to ${to}`;
    return `moved ${entity} “${label}”`;
  }

  if (a.action === "status_changed") {
    const meta = a.metadata as { to?: string } | null;
    const to = meta?.to
      ? (PRODUCT_STATUS_META[meta.to as ProductStatus]?.label ?? meta.to)
      : null;
    return to
      ? `marked ${entity} “${label}” as ${to}`
      : `updated ${entity} “${label}”`;
  }

  const verb = VERB[a.action] ?? a.action;
  return `${verb} ${entity} “${label}”`;
}
