"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import {
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_META,
  type OpportunityStage,
} from "@/lib/domain";
import { requireUser } from "@/lib/permissions";
import { opportunity } from "@/lib/schema";

const oppInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  clientId: z.string().min(1, "Client is required"),
  stage: z.enum(OPPORTUNITY_STAGES),
  value: z.coerce.number().min(0).default(0),
  currency: z.string().trim().min(1).max(8).default("EUR"),
  probability: z.coerce.number().min(0).max(100).optional(),
  destination: z.string().trim().max(200).optional(),
  travelStartDate: z.string().optional(),
  travelEndDate: z.string().optional(),
  paxCount: z.coerce.number().int().min(1).default(1),
  expectedCloseDate: z.string().optional(),
  lostReason: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(5000).optional(),
  assignedToId: z.string().trim().optional(),
});

export type OpportunityInput = z.input<typeof oppInput>;

function toDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createOpportunity(
  input: OpportunityInput
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = oppInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;
  const stage = d.stage as OpportunityStage;

  const [row] = await db
    .insert(opportunity)
    .values({
      title: d.title,
      clientId: d.clientId,
      stage,
      value: String(d.value),
      currency: d.currency,
      probability: d.probability ?? OPPORTUNITY_STAGE_META[stage].defaultProbability,
      destination: d.destination || null,
      travelStartDate: toDate(d.travelStartDate),
      travelEndDate: toDate(d.travelEndDate),
      paxCount: d.paxCount,
      expectedCloseDate: toDate(d.expectedCloseDate),
      lostReason: d.lostReason || null,
      notes: d.notes || null,
      assignedToId: d.assignedToId || user.id,
      createdById: user.id,
    })
    .returning({ id: opportunity.id });

  if (!row) return { ok: false, error: "Failed to create opportunity" };

  await logActivity({
    userId: user.id,
    action: "created",
    entityType: "opportunity",
    entityId: row.id,
    entityLabel: d.title,
  });

  revalidatePath("/opportunities");
  revalidatePath(`/clients/${d.clientId}`);
  return { ok: true, data: { id: row.id } };
}

export async function updateOpportunity(
  id: string,
  input: OpportunityInput
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = oppInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;
  const stage = d.stage as OpportunityStage;

  const existing = await db.query.opportunity.findFirst({
    where: eq(opportunity.id, id),
  });
  if (!existing) return { ok: false, error: "Opportunity not found" };

  await db
    .update(opportunity)
    .set({
      title: d.title,
      clientId: d.clientId,
      stage,
      value: String(d.value),
      currency: d.currency,
      probability: d.probability ?? OPPORTUNITY_STAGE_META[stage].defaultProbability,
      destination: d.destination || null,
      travelStartDate: toDate(d.travelStartDate),
      travelEndDate: toDate(d.travelEndDate),
      paxCount: d.paxCount,
      expectedCloseDate: toDate(d.expectedCloseDate),
      lostReason: d.lostReason || null,
      notes: d.notes || null,
      assignedToId: d.assignedToId || null,
    })
    .where(eq(opportunity.id, id));

  await logActivity({
    userId: user.id,
    action: existing.stage !== stage ? "stage_changed" : "updated",
    entityType: "opportunity",
    entityId: id,
    entityLabel: d.title,
    metadata:
      existing.stage !== stage ? { from: existing.stage, to: stage } : null,
  });

  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${id}`);
  return { ok: true };
}

/** Lightweight stage move used by the pipeline board. */
export async function changeStage(
  id: string,
  stage: OpportunityStage
): Promise<ActionResult> {
  const user = await requireUser();
  if (!OPPORTUNITY_STAGES.includes(stage)) {
    return { ok: false, error: "Invalid stage" };
  }
  const existing = await db.query.opportunity.findFirst({
    where: eq(opportunity.id, id),
  });
  if (!existing) return { ok: false, error: "Opportunity not found" };

  await db
    .update(opportunity)
    .set({
      stage,
      probability: OPPORTUNITY_STAGE_META[stage].defaultProbability,
    })
    .where(eq(opportunity.id, id));

  await logActivity({
    userId: user.id,
    action: "stage_changed",
    entityType: "opportunity",
    entityId: id,
    entityLabel: existing.title,
    metadata: { from: existing.stage, to: stage },
  });

  revalidatePath("/opportunities");
  revalidatePath(`/opportunities/${id}`);
  return { ok: true };
}

export async function deleteOpportunity(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await db.query.opportunity.findFirst({
    where: eq(opportunity.id, id),
  });
  if (!existing) return { ok: false, error: "Opportunity not found" };

  if (
    user.role !== "manager" &&
    existing.assignedToId !== user.id &&
    existing.createdById !== user.id
  ) {
    return { ok: false, error: "You don't have permission to delete this" };
  }

  await db.delete(opportunity).where(eq(opportunity.id, id));

  await logActivity({
    userId: user.id,
    action: "deleted",
    entityType: "opportunity",
    entityId: id,
    entityLabel: existing.title,
  });

  revalidatePath("/opportunities");
  return { ok: true };
}
