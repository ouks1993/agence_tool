import { tool } from "ai";
import { and, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import {
  headlineTotal,
  num,
  sumByCurrency,
} from "@/lib/analytics";
import { db } from "@/lib/db";
import {
  BOOKING_STATUS_META,
  DEFAULT_CURRENCY,
  LEAD_SOURCE_LABEL,
  OPPORTUNITY_STAGE_META,
  PRODUCT_STATUS_META,
  type BookingStatus,
  type LeadSource,
  type OpportunityStage,
  type ProductStatus,
} from "@/lib/domain";
import { client as clientTable } from "@/lib/schema";

/** How many nested rows (bookings/proposals/opportunities) a detail call returns. */
const ROW_LIMIT = 25;

const iso = (d: Date | null | undefined): string | null =>
  d ? d.toISOString() : null;

/**
 * Read tools for the assistant that answer questions about a specific client:
 * profile, derived financials (DZD-only, currency-safe) and their linked
 * bookings / proposals / opportunities.
 *
 * Tenant safety: `ctx.agencyId` scopes EVERY query — the assistant can never
 * read another agency's client or its related records.
 */
export function makeClientTools(ctx: { agencyId: string }) {
  return {
    getClientDetails: tool({
      description:
        "Get a full profile of ONE client by id or name: contact details, owner, source, status, plus derived financials (lifetime value, open balance — both in DZD, currency-safe) and their recent bookings, proposals and opportunities. Use for questions like 'tell me about client X', 'what has this client booked', 'what's their outstanding balance', 'is this client still active'. Resolve by name when no id is known; if several clients match the name it returns the options to disambiguate.",
      inputSchema: z
        .object({
          clientId: z
            .string()
            .optional()
            .describe("Exact client id, if known (from findClients)."),
          name: z
            .string()
            .optional()
            .describe("Client name (or part of it) to look up when no id is known."),
        })
        .refine((v) => Boolean(v.clientId || v.name), {
          message: "Provide clientId or name",
        }),
      execute: async ({ clientId, name }) => {
        try {
          // Agency scope is mandatory — every path below ANDs onto it, so a
          // guessed id or a foreign name can never resolve to another tenant.
          const agencyScope = eq(clientTable.agencyId, ctx.agencyId);

          // 1. Resolve the client (id takes precedence over name).
          if (!clientId) {
            const matches = await db
              .select({
                id: clientTable.id,
                name: clientTable.name,
                email: clientTable.email,
                city: clientTable.city,
                country: clientTable.country,
              })
              .from(clientTable)
              .where(and(agencyScope, ilike(clientTable.name, `%${name!}%`)))
              .orderBy(desc(clientTable.updatedAt))
              .limit(10);

            if (matches.length === 0) {
              return {
                ok: false as const,
                error: `No client found matching "${name}".`,
              };
            }
            if (matches.length > 1) {
              // Ambiguous — hand back the options for the model to disambiguate.
              return {
                ok: true as const,
                ambiguous: true as const,
                message: `Multiple clients match "${name}". Ask which one (or pass a clientId).`,
                options: matches,
              };
            }
            clientId = matches[0]!.id;
          }

          // 2. Load the full record + relations, agency-scoped. Mirrors the
          //    client profile page (owner, bookings + payments).
          const c = await db.query.client.findFirst({
            where: and(eq(clientTable.id, clientId), agencyScope),
            with: {
              owner: { columns: { id: true, name: true } },
              bookings: {
                orderBy: (b, { desc: d }) => [d(b.createdAt)],
                with: { payments: true },
              },
            },
          });

          if (!c) {
            return {
              ok: false as const,
              error: "Client not found in this agency.",
            };
          }

          // 3. Linked opportunities and proposals (agency-scoped). Mirrors the
          //    profile page's parallel queries.
          const [opportunities, proposals] = await Promise.all([
            db.query.opportunity.findMany({
              where: (o, { and: a, eq: e }) =>
                a(e(o.clientId, c.id), e(o.agencyId, ctx.agencyId)),
              orderBy: (o, { desc: d }) => [d(o.createdAt)],
              limit: ROW_LIMIT + 1,
            }),
            db.query.product.findMany({
              where: (p, { and: a, eq: e }) =>
                a(e(p.clientId, c.id), e(p.agencyId, ctx.agencyId)),
              orderBy: (p, { desc: d }) => [d(p.createdAt)],
              limit: ROW_LIMIT + 1,
            }),
          ]);

          // 4. Derived financials — DZD only, never blend currencies.
          //    Lifetime value = Σ booking totalAmount in DZD.
          const lifetimeByCurrency = sumByCurrency(
            c.bookings,
            (b) => num(b.totalAmount),
            (b) => b.currency
          );
          const lifetimeValue = headlineTotal(lifetimeByCurrency);

          // Open balance = Σ(total − completed DZD payments) across DZD
          // bookings, floored at 0 (a credit is not shown as a liability).
          const openBalance = Math.max(
            0,
            c.bookings
              .filter((b) => b.currency === DEFAULT_CURRENCY)
              .reduce((sum, b) => {
                const total = num(b.totalAmount);
                const paid = b.payments
                  .filter(
                    (p) =>
                      p.currency === DEFAULT_CURRENCY && p.status === "completed"
                  )
                  .reduce((s, p) => s + num(p.amount), 0);
                return sum + (total - paid);
              }, 0)
          );

          // 5. Shape recent rows (cap at ROW_LIMIT, report truncation).
          const recentBookings = c.bookings.slice(0, ROW_LIMIT).map((b) => ({
            id: b.id,
            reference: b.reference,
            status: b.status,
            statusLabel:
              BOOKING_STATUS_META[b.status as BookingStatus]?.label ?? b.status,
            destination: b.destination,
            departDate: iso(b.departDate),
            returnDate: iso(b.returnDate),
            value: num(b.totalAmount),
            currency: b.currency,
          }));

          const recentProposals = proposals.slice(0, ROW_LIMIT).map((p) => ({
            id: p.id,
            reference: p.reference,
            title: p.title,
            status: p.status,
            statusLabel:
              PRODUCT_STATUS_META[p.status as ProductStatus]?.label ?? p.status,
            destination: p.destination,
            value: num(p.totalPrice),
            currency: p.currency,
          }));

          const recentOpportunities = opportunities
            .slice(0, ROW_LIMIT)
            .map((o) => ({
              id: o.id,
              title: o.title,
              stage: o.stage,
              stageLabel:
                OPPORTUNITY_STAGE_META[o.stage as OpportunityStage]?.label ??
                o.stage,
              destination: o.destination,
              value: num(o.value),
              currency: o.currency,
            }));

          return {
            ok: true as const,
            client: {
              id: c.id,
              name: c.name,
              type: c.type,
              status: c.status,
              email: c.email,
              phone: c.phone,
              company: c.company,
              city: c.city,
              country: c.country,
              owner: c.owner?.name ?? null,
              source: c.source
                ? LEAD_SOURCE_LABEL[c.source as LeadSource] ?? c.source
                : null,
              createdAt: iso(c.createdAt),
            },
            stats: {
              // Headline financials are DZD (agency base currency).
              lifetimeValue: { value: lifetimeValue, currency: DEFAULT_CURRENCY },
              openBalance: { value: openBalance, currency: DEFAULT_CURRENCY },
              bookingsCount: c.bookings.length,
              proposalsCount: proposals.length,
              opportunitiesCount: opportunities.length,
              // Any non-DZD booking value, surfaced separately (never blended).
              otherCurrencyValue: Object.fromEntries(
                Object.entries(lifetimeByCurrency).filter(
                  ([cur]) => cur !== DEFAULT_CURRENCY
                )
              ),
            },
            recentBookings: {
              rows: recentBookings,
              totalCount: c.bookings.length,
              truncated: c.bookings.length > ROW_LIMIT,
            },
            recentProposals: {
              rows: recentProposals,
              totalCount: proposals.length,
              truncated: proposals.length > ROW_LIMIT,
            },
            recentOpportunities: {
              rows: recentOpportunities,
              totalCount: opportunities.length,
              truncated: opportunities.length > ROW_LIMIT,
            },
          };
        } catch (err) {
          console.error("[chat:tool:getClientDetails]", err);
          return {
            ok: false as const,
            error: "Could not load the client details. Please try again.",
          };
        }
      },
    }),
  };
}
