import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  headlineTotal,
  otherCurrencies,
  sumByCurrency,
  topN,
} from "@/lib/analytics";
import { db } from "@/lib/db";
import {
  COMMISSION_STATUSES,
  COMMISSION_STATUS_META,
  DEFAULT_CURRENCY,
  type CommissionStatus,
} from "@/lib/domain";
import { paymentSummary } from "@/lib/payments/summary";
import { booking, commission, user as userTable } from "@/lib/schema";

/**
 * Read-only finance/commissions tools for the Atlas assistant.
 *
 * TENANT SAFETY: every query is scoped to `ctx.agencyId`. Bookings and
 * commissions carry `agencyId` directly; payments have no agencyId of their own,
 * so they are read through the parent booking (see financeOverview).
 *
 * CURRENCY: DZD-first. Money is NEVER blended across currencies — each figure is
 * grouped with `sumByCurrency`, the base-currency (DZD) headline is returned via
 * `headlineTotal`, and any non-DZD totals are surfaced separately via
 * `otherCurrencies`. Raw numeric values + a `currency` field are returned; the
 * model formats them. Mirrors src/app/(app)/finance/page.tsx and
 * src/app/(app)/commissions/page.tsx.
 */
export function makeFinanceTools(ctx: { agencyId: string }) {
  return {
    financeOverview: tool({
      description:
        "Get the agency's money picture in DZD: confirmed revenue, cash collected, outstanding balance owed, and overdue amount+count. Use for questions like 'how much have we collected', 'what's still outstanding', 'how much revenue is confirmed', or 'how much is overdue'. All headline figures are DZD; any non-DZD amounts are listed separately, never blended in.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          // Pull every booking for the agency with its payments (payments have no
          // agencyId, so scoping flows through the parent booking). Balances are
          // computed in code with `paymentSummary`, exactly like the finance page.
          const bookings = await db.query.booking.findMany({
            where: eq(booking.agencyId, ctx.agencyId),
            with: { payments: true },
            limit: 1000,
          });

          const now = new Date();

          // Per-booking AR in the booking's own currency so downstream rollups
          // can group by it — an EUR booking must never enter the DZD headline.
          const receivables = bookings
            .filter((b) => b.status !== "cancelled")
            .map((b) => {
              const total = parseFloat(b.totalAmount || "0");
              const { paid, balance } = paymentSummary(b.payments, total);
              const currency = b.currency || DEFAULT_CURRENCY;
              const isOverdue =
                !!b.departDate &&
                new Date(b.departDate) < now &&
                balance > 0.005;
              return { total, paid, balance, currency, isOverdue };
            });

          // Outstanding balance: positive balances grouped by currency.
          const outstandingByCur = sumByCurrency(
            receivables,
            (r) => Math.max(r.balance, 0),
            (r) => r.currency
          );
          const outstandingBalance = headlineTotal(outstandingByCur);
          const outstandingOther = otherCurrencies(outstandingByCur);

          // Collected: completed payments minus refunds, grouped by payment currency.
          const paymentRows = bookings.flatMap((b) => b.payments);
          const collectedByCur = sumByCurrency(
            paymentRows.filter((p) => p.status === "completed"),
            (p) =>
              p.kind === "refund"
                ? -parseFloat(p.amount || "0")
                : parseFloat(p.amount || "0"),
            (p) => p.currency || DEFAULT_CURRENCY
          );
          const collected = headlineTotal(collectedByCur);
          const collectedOther = otherCurrencies(collectedByCur);

          // Confirmed revenue: confirmed/paid bookings, grouped by booking currency.
          const confirmedBookings = bookings.filter(
            (b) => b.status === "confirmed" || b.status === "paid"
          );
          const confirmedByCur = sumByCurrency(
            confirmedBookings,
            (b) => parseFloat(b.totalAmount || "0"),
            (b) => b.currency || DEFAULT_CURRENCY
          );
          const confirmedRevenue = headlineTotal(confirmedByCur);
          const confirmedOther = otherCurrencies(confirmedByCur);

          // Overdue: bookings past departure with a positive balance. Amount is
          // grouped by currency so we never blend an EUR overdue into the DZD one.
          const overdueReceivables = receivables.filter((r) => r.isOverdue);
          const overdueCount = overdueReceivables.length;
          const overdueByCur = sumByCurrency(
            overdueReceivables,
            (r) => Math.max(r.balance, 0),
            (r) => r.currency
          );
          const overdueAmount = headlineTotal(overdueByCur);
          const overdueOther = otherCurrencies(overdueByCur);

          const round = (n: number) => Math.round(n * 100) / 100;

          return {
            ok: true as const,
            currency: DEFAULT_CURRENCY,
            confirmedRevenue: {
              value: round(confirmedRevenue),
              currency: DEFAULT_CURRENCY,
              other: confirmedOther,
            },
            collected: {
              value: round(collected),
              currency: DEFAULT_CURRENCY,
              other: collectedOther,
            },
            outstanding: {
              value: round(outstandingBalance),
              currency: DEFAULT_CURRENCY,
              other: outstandingOther,
            },
            overdue: {
              count: overdueCount,
              value: round(overdueAmount),
              currency: DEFAULT_CURRENCY,
              other: overdueOther,
            },
          };
        } catch (err) {
          console.error("[chat:tool:financeOverview]", err);
          return {
            ok: false as const,
            error: "Could not load the finance overview. Please try again.",
          };
        }
      },
    }),

    commissionsOverview: tool({
      description:
        "Get the agency's commission ledger grouped by status (pending / earned / invoiced / paid), each with a count and DZD amount, plus optionally the top-earning agents. Use for questions like 'how much commission is pending', 'what have we earned in commission', 'how much commission has been paid out', or 'who earned the most commission'. Amounts are grouped by currency — the DZD headline is returned and any non-DZD totals are listed separately.",
      inputSchema: z.object({
        includeTopAgents: z
          .boolean()
          .default(false)
          .describe(
            "When true, also return the top agents by commission amount (agency_to_agent) — answers 'who earned the most'."
          ),
      }),
      execute: async ({ includeTopAgents }) => {
        try {
          // Whole ledger for the agency (agencyId is on the commission row).
          // We aggregate in code so we can group each figure by currency and
          // keep the base-currency (DZD) headline separate from strays.
          const rows = await db
            .select({
              status: commission.status,
              type: commission.type,
              amount: commission.amount,
              currency: commission.currency,
              agentUserId: commission.agentUserId,
            })
            .from(commission)
            .where(eq(commission.agencyId, ctx.agencyId));

          // Per-status: count (currency-agnostic) + DZD headline amount + strays.
          // "void" is tracked but not part of the money question; we still expose
          // its count so the model can answer "how many voided" if asked.
          const byStatus = COMMISSION_STATUSES.map((status) => {
            const statusRows = rows.filter((r) => r.status === status);
            const byCur = sumByCurrency(
              statusRows,
              (r) => parseFloat(r.amount || "0"),
              (r) => r.currency || DEFAULT_CURRENCY
            );
            return {
              status,
              label:
                COMMISSION_STATUS_META[status as CommissionStatus]?.label ??
                status,
              count: statusRows.length,
              value: Math.round(headlineTotal(byCur) * 100) / 100,
              currency: DEFAULT_CURRENCY,
              other: otherCurrencies(byCur),
            };
          });

          const result: {
            ok: true;
            currency: string;
            byStatus: typeof byStatus;
            topAgents?: { agent: string; value: number; currency: string }[];
          } = {
            ok: true,
            currency: DEFAULT_CURRENCY,
            byStatus,
          };

          if (includeTopAgents) {
            // Top earners: agency_to_agent commissions only, joined to the user
            // for the agent name. DZD headline only (base-currency comparison).
            const agentRows = await db
              .select({
                amount: commission.amount,
                currency: commission.currency,
                agentName: userTable.name,
              })
              .from(commission)
              .leftJoin(userTable, eq(userTable.id, commission.agentUserId))
              .where(
                and(
                  eq(commission.agencyId, ctx.agencyId),
                  eq(commission.type, "agency_to_agent")
                )
              );

            const topAgents = topN(
              agentRows.filter(
                (r) => (r.currency || DEFAULT_CURRENCY) === DEFAULT_CURRENCY
              ),
              (r) => r.agentName,
              (r) => parseFloat(r.amount || "0"),
              5
            ).map((p) => ({
              agent: p.label,
              value: p.value,
              currency: DEFAULT_CURRENCY,
            }));

            result.topAgents = topAgents;
          }

          return result;
        } catch (err) {
          console.error("[chat:tool:commissionsOverview]", err);
          return {
            ok: false as const,
            error: "Could not load the commissions overview. Please try again.",
          };
        }
      },
    }),
  };
}
