/**
 * Data export endpoints (BI-ready CSV / Excel). Agency-scoped and limited to
 * roles that can view finance (admin, manager, finance) since several datasets
 * carry revenue and commission figures.
 *
 *   GET /api/export/clients?format=csv
 *   GET /api/export/bookings?format=xlsx&from=2026-01-01&to=2026-06-30
 *   GET /api/export/workbook?format=xlsx           (all datasets, one workbook)
 */
import { NextResponse } from "next/server";
import { canViewFinance } from "@/lib/domain";
import { requireAgencyUser } from "@/lib/permissions";
import { DATASETS, type DateRange } from "@/lib/export/datasets";
import { toCsv } from "@/lib/export/csv";
import { toXlsx, type Sheet } from "@/lib/export/xlsx";

export const runtime = "nodejs";

function parseRange(url: URL): DateRange {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const d = (v: string | null) => {
    if (!v) return null;
    const dt = new Date(v);
    return Number.isNaN(dt.getTime()) ? null : dt;
  };
  return { from: d(from), to: d(to) };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ entity: string }> }
) {
  const user = await requireAgencyUser();
  if (!canViewFinance(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { entity } = await params;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const range = parseRange(url);
  const stamp = new Date().toISOString().slice(0, 10);

  // Whole-agency workbook (all datasets as sheets) — Excel only.
  if (entity === "workbook") {
    const sheets: Sheet[] = [];
    for (const ds of Object.values(DATASETS)) {
      const { columns, rows } = await ds.load(user.agencyId, range);
      sheets.push({ name: ds.label, columns, rows });
    }
    const buf = await toXlsx(sheets);
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="atlas-export-${stamp}.xlsx"`,
      },
    });
  }

  const dataset = DATASETS[entity];
  if (!dataset) {
    return NextResponse.json({ error: "Unknown dataset" }, { status: 404 });
  }

  const { columns, rows } = await dataset.load(user.agencyId, range);

  if (format === "csv") {
    return new NextResponse(toCsv(columns, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${dataset.key}-${stamp}.csv"`,
      },
    });
  }

  const buf = await toXlsx([{ name: dataset.label, columns, rows }]);
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${dataset.key}-${stamp}.xlsx"`,
    },
  });
}
