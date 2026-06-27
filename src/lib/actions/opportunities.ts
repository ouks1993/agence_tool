"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import {
  canDeleteRecords,
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_META,
  type OpportunityStage,
} from "@/lib/domain";
import { requireAgencyUser } from "@/lib/permissions";
import { client, opportunity } from "@/lib/schema";

const oppInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  clientId: z.string().min(1, "Client is required"),
  stage: z.enum(OPPORTUNITY_STAGES),
  value: z.coerce.number().min(0).default(0),
  currency: z.string().trim().min(1).max(8).default("DZD"),
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
  const user = await requireAgencyUser();
  const parsed = oppInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;
  const stage = d.stage as OpportunityStage;

  // Cross-tenant guard: the referenced client must belong to this agency,
  // otherwise an opportunity could be attached to another agency's client.
  const linkedClient = await db.query.client.findFirst({
    where: and(eq(client.id, d.clientId), eq(client.agencyId, user.agencyId)),
    columns: { id: true },
  });
  if (!linkedClient) return { ok: false, error: "Not found" };

  const [row] = await db
    .insert(opportunity)
    .values({
      agencyId: user.agencyId,
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
    agencyId: user.agencyId,
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
  const user = await requireAgencyUser();
  const parsed = oppInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;
  const stage = d.stage as OpportunityStage;

  const existing = await db.query.opportunity.findFirst({
    where: and(eq(opportunity.id, id), eq(opportunity.agencyId, user.agencyId)),
  });
  if (!existing) return { ok: false, error: "Opportunity not found" };

  // Cross-tenant guard: the referenced client must belong to this agency.
  const linkedClient = await db.query.client.findFirst({
    where: and(eq(client.id, d.clientId), eq(client.agencyId, user.agencyId)),
    columns: { id: true },
  });
  if (!linkedClient) return { ok: false, error: "Not found" };

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
    .where(and(eq(opportunity.id, id), eq(opportunity.agencyId, user.agencyId)));

  await logActivity({
    agencyId: user.agencyId,
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
  const user = await requireAgencyUser();
  if (!OPPORTUNITY_STAGES.includes(stage)) {
    return { ok: false, error: "Invalid stage" };
  }
  const existing = await db.query.opportunity.findFirst({
    where: and(eq(opportunity.id, id), eq(opportunity.agencyId, user.agencyId)),
  });
  if (!existing) return { ok: false, error: "Opportunity not found" };

  await db
    .update(opportunity)
    .set({
      stage,
      probability: OPPORTUNITY_STAGE_META[stage].defaultProbability,
    })
    .where(and(eq(opportunity.id, id), eq(opportunity.agencyId, user.agencyId)));

  await logActivity({
    agencyId: user.agencyId,
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
  const user = await requireAgencyUser();
  const existing = await db.query.opportunity.findFirst({
    where: and(eq(opportunity.id, id), eq(opportunity.agencyId, user.agencyId)),
  });
  if (!existing) return { ok: false, error: "Opportunity not found" };

  if (
    !canDeleteRecords(user.role) &&
    existing.assignedToId !== user.id &&
    existing.createdById !== user.id
  ) {
    return { ok: false, error: "You don't have permission to delete this" };
  }

  await db
    .delete(opportunity)
    .where(and(eq(opportunity.id, id), eq(opportunity.agencyId, user.agencyId)));

  await logActivity({
    agencyId: user.agencyId,
    userId: user.id,
    action: "deleted",
    entityType: "opportunity",
    entityId: id,
    entityLabel: existing.title,
  });

  revalidatePath("/opportunities");
  return { ok: true };
}
