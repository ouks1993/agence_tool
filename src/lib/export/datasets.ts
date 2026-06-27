/**
 * BI export datasets. Each dataset produces a uniform { columns, rows } shape
 * consumed by both the CSV and XLSX writers. Everything is agency-scoped and,
 * where a created date exists, filterable by date range.
 *
 * Convention: every controlled field is emitted as BOTH a stable `*_code`
 * column (for pivoting/joins) and a human `*_label` column (for reading), so
 * the same file works for Power BI and for a person in Excel. Amounts are DZD.
 */
import { and, asc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  BOOKING_STATUS_META,
  CLIENT_STATUS_META,
  GENDER_LABEL,
  INDUSTRY_LABEL,
  LEAD_SOURCE_LABEL,
  LOST_REASON_LABEL,
  OPPORTUNITY_STAGE_META,
  TITLE_LABEL,
  TRAVEL_PURPOSE_LABEL,
  TRIP_TYPE_LABEL,
} from "@/lib/domain";
import { paymentSummary } from "@/lib/payments/summary";
import {
  booking,
  bookingItem,
  bookingTraveller,
  client,
  commission,
  opportunity,
  payment,
  supplier,
  user,
} from "@/lib/schema";
import type { Cell } from "./csv";

export type DateRange = { from?: Date | null; to?: Date | null };
export type DatasetResult = { columns: string[]; rows: Cell[][] };
export type Dataset = {
  key: string;
  label: string;
  /** Financial datasets are gated by canViewFinance. */
  financial: boolean;
  load: (agencyId: string, range: DateRange) => Promise<DatasetResult>;
};

const num = (v: string | number | null | undefined): number =>
  v == null ? 0 : typeof v === "string" ? parseFloat(v) || 0 : v;
const iso = (d: Date | string | null | undefined): string => {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};
const lookup = (map: Record<string, { label: string }>, code: string | null) =>
  code ? map[code]?.label ?? code : "";
const flat = (map: Record<string, string>, code: string | null) =>
  code ? map[code] ?? code : "";

/** Builds a createdAt-between predicate for a given column. */
function rangeWhere(col: SQL.Aliased | any, range: DateRange): SQL[] {
  const out: SQL[] = [];
  if (range.from) out.push(gte(col, range.from));
  if (range.to) out.push(lte(col, range.to));
  return out;
}

export const DATASETS: Record<string, Dataset> = {
  clients: {
    key: "clients",
    label: "Clients",
    financial: false,
    async load(agencyId, range) {
      const rows = await db.query.client.findMany({
        where: and(eq(client.agencyId, agencyId), ...rangeWhere(client.createdAt, range)),
        with: { owner: { columns: { name: true } } },
        orderBy: [asc(client.createdAt)],
      });
      return {
        columns: [
          "name", "type", "status_code", "status_label", "email", "phone",
          "company", "source_code", "source_label", "industry_code",
          "industry_label", "city", "country", "owner", "created_date",
        ],
        rows: rows.map((c) => [
          c.name, c.type, c.status, lookup(CLIENT_STATUS_META, c.status),
          c.email, c.phone, c.company,
          c.source, flat(LEAD_SOURCE_LABEL, c.source),
          c.industry, flat(INDUSTRY_LABEL, c.industry),
          c.city, c.country, c.owner?.name ?? "", iso(c.createdAt),
        ]),
      };
    },
  },

  opportunities: {
    key: "opportunities",
    label: "Opportunities",
    financial: false,
    async load(agencyId, range) {
      const rows = await db.query.opportunity.findMany({
        where: and(eq(opportunity.agencyId, agencyId), ...rangeWhere(opportunity.createdAt, range)),
        with: { client: { columns: { name: true } }, assignedTo: { columns: { name: true } } },
        orderBy: [asc(opportunity.createdAt)],
      });
      return {
        columns: [
          "title", "client", "stage_code", "stage_label", "value", "currency",
          "probability", "travel_purpose_code", "travel_purpose_label",
          "destination", "lost_reason_code", "lost_reason_label",
          "travel_start", "travel_end", "expected_close", "assignee", "created_date",
        ],
        rows: rows.map((o) => [
          o.title, o.client?.name ?? "", o.stage, lookup(OPPORTUNITY_STAGE_META, o.stage),
          num(o.value), o.currency, o.probability,
          o.travelPurpose, flat(TRAVEL_PURPOSE_LABEL, o.travelPurpose),
          o.destination, o.lostReason, flat(LOST_REASON_LABEL, o.lostReason),
          iso(o.travelStartDate), iso(o.travelEndDate), iso(o.expectedCloseDate),
          o.assignedTo?.name ?? "", iso(o.createdAt),
        ]),
      };
    },
  },

  bookings: {
    key: "bookings",
    label: "Bookings",
    financial: true,
    async load(agencyId, range) {
      const rows = await db.query.booking.findMany({
        where: and(eq(booking.agencyId, agencyId), ...rangeWhere(booking.createdAt, range)),
        with: {
          client: { columns: { name: true } },
          payments: { columns: { amount: true, kind: true, status: true } },
        },
        orderBy: [asc(booking.createdAt)],
      });
      return {
        columns: [
          "reference", "client", "status_code", "status_label", "destination",
          "trip_type_code", "trip_type_label", "travel_purpose_code",
          "travel_purpose_label", "depart_date", "return_date", "total",
          "paid", "balance", "currency", "created_date",
        ],
        rows: rows.map((b) => {
          const total = num(b.totalAmount);
          const { paid, balance } = paymentSummary(b.payments, total);
          return [
            b.reference, b.client?.name ?? "", b.status, lookup(BOOKING_STATUS_META, b.status),
            b.destination, b.tripType, flat(TRIP_TYPE_LABEL, b.tripType),
            b.travelPurpose, flat(TRAVEL_PURPOSE_LABEL, b.travelPurpose),
            iso(b.departDate), iso(b.returnDate), total, paid, balance,
            b.currency, iso(b.createdAt),
          ];
        }),
      };
    },
  },

  booking_items: {
    key: "booking_items",
    label: "Booking items",
    financial: true,
    async load(agencyId, range) {
      const rows = await db
        .select({
          reference: booking.reference,
          type: bookingItem.type,
          title: bookingItem.title,
          supplier: bookingItem.supplier,
          bookingRef: bookingItem.bookingRef,
          quantity: bookingItem.quantity,
          amount: bookingItem.amount,
          currency: bookingItem.currency,
          itemStatus: bookingItem.itemStatus,
          startDate: bookingItem.startDate,
        })
        .from(bookingItem)
        .innerJoin(booking, eq(bookingItem.bookingId, booking.id))
        .where(and(eq(booking.agencyId, agencyId), ...rangeWhere(booking.createdAt, range)))
        .orderBy(asc(booking.reference));
      return {
        columns: [
          "booking_reference", "type", "title", "supplier", "supplier_ref",
          "quantity", "amount", "currency", "item_status", "start_date",
        ],
        rows: rows.map((r) => [
          r.reference, r.type, r.title, r.supplier, r.bookingRef,
          r.quantity, num(r.amount), r.currency, r.itemStatus, iso(r.startDate),
        ]),
      };
    },
  },

  travellers: {
    key: "travellers",
    label: "Travellers",
    financial: false,
    async load(agencyId, range) {
      const rows = await db
        .select({
          reference: booking.reference,
          fullName: bookingTraveller.fullName,
          title: bookingTraveller.title,
          gender: bookingTraveller.gender,
          nationality: bookingTraveller.nationality,
          passportNumber: bookingTraveller.passportNumber,
          passportExpiry: bookingTraveller.passportExpiry,
          isLead: bookingTraveller.isLead,
        })
        .from(bookingTraveller)
        .innerJoin(booking, eq(bookingTraveller.bookingId, booking.id))
        .where(and(eq(booking.agencyId, agencyId), ...rangeWhere(booking.createdAt, range)))
        .orderBy(asc(booking.reference));
      return {
        columns: [
          "booking_reference", "full_name", "title_code", "title_label",
          "gender_code", "gender_label", "nationality", "passport_number",
          "passport_expiry", "is_lead",
        ],
        rows: rows.map((r) => [
          r.reference, r.fullName, r.title, flat(TITLE_LABEL, r.title),
          r.gender, flat(GENDER_LABEL, r.gender), r.nationality,
          r.passportNumber, iso(r.passportExpiry), r.isLead ? "yes" : "no",
        ]),
      };
    },
  },

  payments: {
    key: "payments",
    label: "Payments",
    financial: true,
    async load(agencyId, range) {
      const rows = await db
        .select({
          reference: booking.reference,
          amount: payment.amount,
          currency: payment.currency,
          kind: payment.kind,
          method: payment.method,
          status: payment.status,
          reference2: payment.reference,
          createdAt: payment.createdAt,
        })
        .from(payment)
        .innerJoin(booking, eq(payment.bookingId, booking.id))
        .where(and(eq(booking.agencyId, agencyId), ...rangeWhere(payment.createdAt, range)))
        .orderBy(asc(payment.createdAt));
      return {
        columns: [
          "booking_reference", "amount", "currency", "kind", "method",
          "status", "payment_reference", "date",
        ],
        rows: rows.map((r) => [
          r.reference, num(r.amount), r.currency, r.kind, r.method,
          r.status, r.reference2, iso(r.createdAt),
        ]),
      };
    },
  },

  commissions: {
    key: "commissions",
    label: "Commissions",
    financial: true,
    async load(agencyId, range) {
      const rows = await db
        .select({
          bookingRef: booking.reference,
          supplierName: supplier.name,
          agentName: user.name,
          type: commission.type,
          basis: commission.basis,
          rate: commission.rate,
          baseAmount: commission.baseAmount,
          amount: commission.amount,
          currency: commission.currency,
          status: commission.status,
          createdAt: commission.createdAt,
        })
        .from(commission)
        .leftJoin(booking, eq(commission.bookingId, booking.id))
        .leftJoin(supplier, eq(commission.supplierId, supplier.id))
        .leftJoin(user, eq(commission.agentUserId, user.id))
        .where(and(eq(commission.agencyId, agencyId), ...rangeWhere(commission.createdAt, range)))
        .orderBy(asc(commission.createdAt));
      return {
        columns: [
          "booking_reference", "type", "supplier", "agent", "basis", "rate",
          "base_amount", "amount", "currency", "status", "date",
        ],
        rows: rows.map((r) => [
          r.bookingRef ?? "", r.type, r.supplierName ?? "", r.agentName ?? "",
          r.basis, num(r.rate), num(r.baseAmount), num(r.amount), r.currency,
          r.status, iso(r.createdAt),
        ]),
      };
    },
  },

  suppliers: {
    key: "suppliers",
    label: "Suppliers",
    financial: false,
    async load(agencyId, range) {
      const rows = await db.query.supplier.findMany({
        where: and(eq(supplier.agencyId, agencyId), ...rangeWhere(supplier.createdAt, range)),
        orderBy: [asc(supplier.name)],
      });
      return {
        columns: [
          "name", "type", "status", "email", "phone", "city", "country",
          "contact_name", "created_date",
        ],
        rows: rows.map((s) => [
          s.name, s.type, s.status, s.email, s.phone, s.city, s.country,
          s.contactName, iso(s.createdAt),
        ]),
      };
    },
  },
};

export const DATASET_KEYS = Object.keys(DATASETS);
