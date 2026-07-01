import { tool } from "ai";
import { and, desc, eq, ilike, type SQL } from "drizzle-orm";
import { z } from "zod";
import { headlineTotal, num, otherCurrencies, sumByCurrency } from "@/lib/analytics";
import { db } from "@/lib/db";
import {
  DEFAULT_CURRENCY,
  OPEN_STAGES,
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_META,
  PRODUCT_STATUSES,
  PRODUCT_STATUS_META,
  type OpportunityStage,
  type ProductStatus,
} from "@/lib/domain";
import { client, opportunity, product } from "@/lib/schema";

const ROW_LIMIT = 25;

/**
 * Read-only sales tools for the Atlas assistant: proposals (the `product`
 * table — quotes assembled and sent to a client) and the opportunity pipeline.
 *
 * TENANT SAFETY: every query is hard-scoped to `ctx.agencyId` via
 * `eq(<table>.agencyId, ctx.agencyId)`. A platform admin with no agency context
 * (agencyId === "") gets empty results — we never query globally or across
 * tenants.
 *
 * CURRENCY: the agency operates in DZD and we do NOT do FX. Money aggregates go
 * through sumByCurrency + headlineTotal so a stray EUR/USD figure is bucketed
 * separately and never blended into the DZD headline. Raw numeric values are
 * returned with an explicit currency field; the model formats them.
 */
export function makeSalesTools(ctx: { agencyId: string }) {
  const { agencyId } = ctx;

  return {
    listProposals: tool({
      description:
        "List and filter the agency's proposals/quotes (the 'product' records assembled and sent to clients). Filter by status and/or client name. Use for questions like 'which proposals are still pending', 'show accepted quotes', 'what did we send to Acme', or 'list draft proposals'. Statuses: draft | sent | accepted | rejected | expired.",
      inputSchema: z.object({
        status: z
          .enum(PRODUCT_STATUSES)
          .optional()
          .describe("Filter to one proposal status (draft/sent/accepted/rejected/expired)."),
        clientName: z
          .string()
          .optional()
          .describe("Filter to proposals whose client name contains this text."),
      }),
      execute: async (a) => {
        try {
          // Platform admins (no agency) get nothing — never query globally.
          if (!agencyId) {
            return { ok: true as const, proposals: [], totalCount: 0, truncated: false };
          }

          // Always constrain to the caller's agency; optional filters are ANDed
          // on top so we can never read another agency's proposals.
          const conditions: SQL[] = [eq(product.agencyId, agencyId)];
          if (a.status) conditions.push(eq(product.status, a.status));
          if (a.clientName)
            conditions.push(ilike(client.name, `%${a.clientName}%`));
          const where = and(...conditions);

          const rows = await db
            .select({
              id: product.id,
              reference: product.reference,
              title: product.title,
              status: product.status,
              destination: product.destination,
              totalPrice: product.totalPrice,
              currency: product.currency,
              updatedAt: product.updatedAt,
              clientName: client.name,
            })
            .from(product)
            .leftJoin(client, eq(product.clientId, client.id))
            .where(where)
            .orderBy(desc(product.updatedAt))
            .limit(ROW_LIMIT + 1);

          const truncated = rows.length > ROW_LIMIT;
          const page = truncated ? rows.slice(0, ROW_LIMIT) : rows;

          return {
            ok: true as const,
            proposals: page.map((p) => {
              const meta = PRODUCT_STATUS_META[p.status as ProductStatus];
              return {
                reference: p.reference,
                title: p.title,
                clientName: p.clientName ?? null,
                destination: p.destination ?? null,
                status: p.status,
                statusLabel: meta?.label ?? p.status,
                total: num(p.totalPrice),
                currency: p.currency || DEFAULT_CURRENCY,
                updatedAt: p.updatedAt,
              };
            }),
            // We fetch ROW_LIMIT+1 to detect truncation; the shown count is <= 25.
            totalCount: page.length,
            truncated,
          };
        } catch (err) {
          console.error("[chat:tool:listProposals]", err);
          return { ok: false as const, error: "Could not load proposals. Please try again." };
        }
      },
    }),

    pipelineOverview: tool({
      description:
        "Summarise the sales pipeline (opportunities/deals): a breakdown by stage with deal count and total value, plus the biggest open deals. Use for questions like 'what's in the pipeline', 'biggest open deals', 'what's closing soon', or 'how many deals are in the proposal stage'. Values are in DZD. Stages: lead | qualified | proposal | booked | won | lost.",
      inputSchema: z.object({
        stage: z
          .enum(OPPORTUNITY_STAGES)
          .optional()
          .describe("Restrict the top-open-deals list to one stage (lead/qualified/proposal/booked/won/lost)."),
      }),
      execute: async (a) => {
        try {
          // Platform admins (no agency) get an empty pipeline — never query globally.
          if (!agencyId) {
            return {
              ok: true as const,
              currency: DEFAULT_CURRENCY,
              byStage: [],
              openCount: 0,
              openValue: 0,
              topOpenDeals: [],
              totalCount: 0,
              truncated: false,
            };
          }

          const rows = await db.query.opportunity.findMany({
            where: eq(opportunity.agencyId, agencyId),
            with: {
              client: { columns: { name: true } },
              assignedTo: { columns: { id: true, name: true } },
            },
            orderBy: [desc(opportunity.updatedAt)],
            limit: 500,
          });

          const cur = (o: (typeof rows)[number]) => o.currency || DEFAULT_CURRENCY;
          const isOpen = (s: string) =>
            OPEN_STAGES.includes(s as (typeof OPEN_STAGES)[number]);

          // Per-stage: count (currency-agnostic) + DZD-headline value, keeping
          // any stray non-DZD totals separate so nothing is blended.
          const byStage = OPPORTUNITY_STAGES.map((s) => {
            const stageRows = rows.filter((o) => o.stage === s);
            const byCurrency = sumByCurrency(stageRows, (o) => num(o.value), cur);
            return {
              stage: s,
              stageLabel: OPPORTUNITY_STAGE_META[s as OpportunityStage].label,
              count: stageRows.length,
              value: headlineTotal(byCurrency),
              currency: DEFAULT_CURRENCY,
              otherCurrencies: otherCurrencies(byCurrency),
            };
          });

          const openDeals = rows.filter((o) => isOpen(o.stage));
          const openValue = headlineTotal(
            sumByCurrency(openDeals, (o) => num(o.value), cur)
          );

          // Top open deals by value (optionally scoped to one stage). We rank
          // OPEN deals unless a specific stage was requested.
          const candidates = a.stage
            ? rows.filter((o) => o.stage === a.stage)
            : openDeals;
          const ranked = [...candidates].sort((x, y) => num(y.value) - num(x.value));
          const truncated = ranked.length > ROW_LIMIT;
          const topOpenDeals = ranked.slice(0, ROW_LIMIT).map((o) => ({
            title: o.title,
            clientName: o.client?.name ?? null,
            value: num(o.value),
            currency: cur(o),
            stage: o.stage,
            stageLabel:
              OPPORTUNITY_STAGE_META[o.stage as OpportunityStage]?.label ?? o.stage,
            probability: o.probability,
            closeDate: o.expectedCloseDate,
            owner: o.assignedTo?.name ?? null,
          }));

          return {
            ok: true as const,
            currency: DEFAULT_CURRENCY,
            byStage,
            openCount: openDeals.length,
            openValue,
            topOpenDeals,
            totalCount: candidates.length,
            truncated,
          };
        } catch (err) {
          console.error("[chat:tool:pipelineOverview]", err);
          return {
            ok: false as const,
            error: "Could not load the pipeline overview. Please try again.",
          };
        }
      },
    }),
  };
}
