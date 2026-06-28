# Analytics & BI

Decision-oriented dashboards plus standardized data export, all currency-safe.

## Dashboards

Surfaced on the agency dashboard and `/finance`:

- Revenue evolution (monthly)
- Top destinations / clients / markets by revenue
- Revenue per agent
- Conversion rate, average booking value, MoM growth
- Pipeline funnel **by value** + weighted forecast / win rate
- AR aging buckets
- Margin %
- Commission-by-supplier

## Currency-safe by design

No FX conversion (see [business-rules.md](business-rules.md#currency)). Every
metric **groups by currency** rather than summing across, with a **DZD headline**.

## `src/lib/analytics.ts`

Pure helpers (no I/O), unit-testable:

- `sumByCurrency` — totals grouped by currency code
- `monthlyBuckets` — time-series bucketing
- `topN` / `countBy` — rankings and tallies
- `conversionRate`, `growthPct` — rate/growth metrics
- `agingBuckets` — AR aging

Charts render via `src/components/charts/` (recharts 3, tokenized), including
`HBarInsight` and `FunnelInsight`.

## BI export (`/reports`)

Gated by `canViewFinance` (admin/manager/finance). One-click CSV + Excel export of
every core dataset, plus a full multi-sheet workbook.

- `src/lib/export/` — `csv.ts` (RFC-4180 + UTF-8 BOM, Power BI friendly),
  `xlsx.ts` (exceljs workbook), `datasets.ts` (BI dataset registry).
- Each enum field emits **both** `*_code` and `*_label` columns; amounts in DZD,
  dates in ISO; a date-range filter applies.
- Served by `api/export/[entity]` — CSV/XLSX per dataset, or `workbook` = all
  sheets.
