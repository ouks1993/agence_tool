# Analytics & BI

Decision-oriented dashboards plus standardized data export, all currency-safe.
Every metric is computed **server-side, agency-scoped, and in DZD only** — the
chart primitives receive plain `{ label, value }[]` arrays and never touch the
database or perform currency conversion.

## Surfaces

Analytics appears on four routes. All are agency-scoped via
`requireAgencyUser()` (`src/lib/permissions.ts`); the finance-grade surfaces are
additionally gated by `canViewFinance` (`src/lib/domain.ts` → `admin`,
`manager`, `finance`).

| Route | File | Access | Focus |
|---|---|---|---|
| `/dashboard` | `src/app/(app)/dashboard/page.tsx` + `dashboard-insights.tsx` | any agency user | Command center: hero KPIs, pipeline funnel, bookings-by-status, and the streamed Insights section |
| `/finance` | `src/app/(app)/finance/page.tsx` | `canViewFinance` (redirects to `roleHome` otherwise) | AR, collected/outstanding, aging, commissions |
| `/reports` | `src/app/(app)/reports/page.tsx` + `src/components/reports/reports-analytics.tsx` | `canViewFinance` (redirects otherwise) | Period-windowed KPI deck, revenue trend, weighted forecast, BI export |
| `/opportunities` | `src/app/(app)/opportunities/page.tsx` | any agency user | Pipeline KPIs + conversion funnel by value |

### Dashboard (`/dashboard`)

The insights section (`DashboardInsights` in `dashboard-insights.tsx`) is
rendered inside a Suspense boundary — the page shell streams first, then the
insights-specific queries resolve behind `DashboardInsightsSkeleton`. It renders:

- **Finance KPIs (3 tiles, all-time, labelled "· all time"):** Total revenue
  (post-confirmation bookings — `confirmed | paid | ticketed | completed`, DZD),
  Collected (completed payments net of refunds), Won pipeline. The former "MoM
  revenue growth" tile was removed — the hero StatStrip's this-month delta is
  the page's single growth metric (it renders a neutral "no confirmed revenue
  yet this month" note instead of a red −100% chip when the current month is
  still zero).
- **Charts:** Revenue evolution (last 12 months), Top destinations by revenue
  (last 12 months), Top clients by revenue, Revenue per agent (first names
  title-cased), Bookings by status (count donut — center shows the **active**
  count; subtitle reads "N total · M active" when cancellations exist),
  Lead sources (client count), Top source markets (clients by country).

> **Dashboard revenue basis:** everywhere the dashboard says "revenue" it now
> means bookings in a post-confirmation lifecycle status
> (`confirmed | paid | ticketed | completed`), DZD-only — previously
> `confirmed` only, which made "Collected" exceed "Total revenue". The
> `/reports` and `/finance` definitions are unchanged.

The page itself (`dashboard/page.tsx`) also builds a **pipeline funnel by value**
across `OPPORTUNITY_STAGES` (excluding `lost`), summing DZD `opportunity.value`
per stage, plus a win-rate footer.

### Finance (`/finance`)

Derives accounts-receivable from a single agency-scoped `booking` query (with its
`payments` relation) — balances are computed in code via `paymentSummary`, never
in SQL. Surfaces:

- **KPIs:** Outstanding balance, Collected, Confirmed revenue, Overdue count.
- **Charts:** Collected over time (6-month area, net of refunds), Payments by
  method (donut), Outstanding vs collected (bar), AR aging (bar), Commission
  earned by supplier (horizontal bar, `supplier_to_agency`, DZD, top 8).
- **Tables:** Accounts receivable (outstanding balances, soonest departure
  first), Recent payments (15 most recent completed, refunds shown negative/red).
- **Revenue summary:** Confirmed revenue, Collected, Agency margin (Σ
  `product.totalPrice − product.totalCost`), Margin % of price, Won opportunities.
- **Commissions:** Pending / Earned / Paid KPI cards. These use the commission
  ledger's own currency (preferring EUR, else the first currency present) — the
  one place a non-DZD headline is shown, because commissions are frequently
  supplier-settled in EUR.

### Reports & analytics (`/reports`)

The primary view is `ReportsAnalytics` (`src/components/reports/reports-analytics.tsx`),
computed entirely server-side and windowed by a `?period=` search param. It is
wrapped in Suspense with `ReportsAnalyticsSkeleton` while the agency-wide queries
resolve. Below it sits the **Export data** hub (`#export` anchor).

**KPI deck** (6 tiles, each with a "vs previous period" delta pill):

| KPI | Definition | Notes |
|---|---|---|
| Revenue | Σ `totalAmount` of confirmed/paid DZD bookings created in-window | Compact DZD |
| Gross profit | Σ (`totalPrice − totalCost`) of accepted DZD proposals in-window | Only shown when in-window proposal revenue > 0 |
| Bookings | Count of all bookings created in-window | — |
| Conversion | Won ÷ (won + lost) opportunities created in-window | Delta in pp |
| Avg margin | Gross profit ÷ proposal revenue | Only shown when a cost basis exists; delta in pp |
| Repeat rate | Clients with ≥2 bookings ÷ clients with ≥1, in-window | `—` when no clients booked |

> **Windowing is by `createdAt` (cohort semantics), not cash-recognition.**
> Revenue/funnel KPIs window on when a booking or opportunity was *created*, not
> when it was confirmed or paid — a booking created in one period but confirmed/
> paid later is counted in its creation-period cohort, not the period money
> actually moved. This is a deliberate, documented choice (cohort-by-creation),
> not a bug; a long sales-cycle booking can be "invisible" in the period it's
> actually settled if you're expecting cash-basis reporting.

**Revenue trend:** trailing 12-month area chart of confirmed DZD revenue, plus a
4-up mini-stat strip (Peak month, 12-mo total, Avg/month, Best route by revenue).

**Next-month forecast card:** the weighted pipeline — Σ (open-stage DZD deal
value × probability/100) — with open-pipeline, win-rate, and forecast-vs-this-month
sub-stats.

**This period at a glance:** Open opportunities, Avg booking value, Outstanding
balance, Proposals accepted (%).

#### Reporting periods

Period windows live in `src/lib/reports/period.ts`. Pills (`PeriodPills`) are
plain `?period=…` links — no client state; the Server Component re-scopes the
metrics on navigation.

| Period | Label | Window |
|---|---|---|
| `30d` | 30D | Last 30 days |
| `mtd` | MTD | Month to date |
| `qtd` | QTD | Quarter to date |
| `12m` | 12M | Trailing 12 whole months (**default**, `DEFAULT_PERIOD`) |
| `ytd` | YTD | Year to date |

`resolvePeriodWindow(period, anchor)` returns a `PeriodWindow` with matching
`from`/`to` **and** an equal-length `prevFrom`/`prevTo` baseline so deltas are
like-for-like. To-date windows (MTD/QTD/YTD) compare against the *same elapsed
length* of the prior period, so a partial month isn't judged against a full one.
All windows are half-open `[from, to)` (`inWindow`), matching how `analytics.ts`
buckets `createdAt`.

## Currency-safe by design

No FX conversion (see [business-rules.md](business-rules.md#currency)). The
agency operates in DZD (`DEFAULT_CURRENCY = "DZD"` in `src/lib/domain.ts`).
Monetary aggregations therefore work on **DZD records only**; any row in another
currency is either reported separately (`sumByCurrency`) or excluded from money
charts — a stray EUR/USD figure is never silently added to a DZD total.
Count-based metrics (funnels, status breakdowns, lead sources) are
currency-agnostic and include every row.

Rounding is defensive throughout: monetary reductions round to 2 dp, and
"other-currency" chips ignore residuals under 0.005.

## `src/lib/analytics.ts`

Pure helpers (no I/O), unit-testable; every function returns plain numbers or
`{ label, value }[]` so a Server Component can compute and hand the result
straight to the (client) chart primitives.

| Helper | Purpose |
|---|---|
| `num(v)` | Coerces a numeric string / nullish value to a finite number (0 fallback) |
| `sumByCurrency(rows, amountFn, currencyFn)` | Totals grouped by currency code, e.g. `{ DZD: 1200000, EUR: 800 }` |
| `headlineTotal(byCurrency)` | The DZD entry from a `sumByCurrency` map |
| `otherCurrencies(byCurrency)` | Non-DZD currencies with a non-zero total (for "stray currency" chips) |
| `growthPct(current, previous)` | Period-over-period growth %, rounded to 1 dp; `null` when no baseline |
| `conversionRate(part, whole)` | 0–100 rate, rounded to 1 dp; 0 when `whole` is 0 |
| `monthlyBuckets(rows, dateFn, valueFn, monthsBack?, anchor?)` | Time-series bucketing over the last N calendar months; empty months render at 0 so trends never gap |
| `topN(rows, keyFn, valueFn, n?, fallbackLabel?)` | Top-N aggregation by string key, summed and sorted desc (zero-value entries dropped) |
| `countBy(rows, keyFn, n?, fallbackLabel?)` | `topN` with a unit value — tallies rows by key |
| `agingBuckets(rows, anchor?)` | AR aging into `Not due` / `0–30d` / `31–60d` / `61d+` by days past a reference (departure) date |

`monthlyBuckets` and `agingBuckets` accept an `anchor` "now" so they can be
tested against a fixed date. `paymentSummary` (`src/lib/payments/summary.ts`)
computes `{ paid, balance }` from completed payments (refunds subtracted) and is
reused across finance, reports, dashboard, and the bookings export.

## Chart component system (`src/components/charts/insight-charts.tsx`)

Lightweight on-brand primitives built directly on **recharts 3** (`recharts@^3.8.0`)
and the design-system `--chart-*` / `--popover` tokens. All props are
**serializable** (no function props), so Server Components compute the data and
render these client components directly. Formatting is selected via a `format`
enum (`"number" | "currency"`) resolved client-side by `makeFormatter`
(`Intl.NumberFormat`), with `currency` defaulting to `"DZD"`.

| Component | Type | Typical use |
|---|---|---|
| `BarInsight` | Vertical bars | Bookings by country, team performance |
| `HBarInsight` | Horizontal bars | Long labels — top destinations/clients/suppliers |
| `AreaInsight` | Gradient area trend | Revenue / bookings over time |
| `DonutInsight` | Donut + legend | Bookings by status, payments by method |
| `FunnelInsight` | Pure-CSS stage bars | Pipeline conversion (by value) |

Shared behaviour:

- Colors come from a 6-entry `CHART_COLORS` palette (`--chart-1` … `--chart-6`),
  cycled via `colorAt(i)`. Tooltips use `--popover` / `--border` /
  `--radius-md`; axis ticks use `--muted-foreground`.
- **Axis ticks are compact** (`makeAxisTickFormatter`): large values render as
  lowercase compact units ("1.2m", "600k") with no currency code — the full
  `Intl` precision lives in the tooltip. This keeps 7–8-digit DZD figures from
  clipping the Y axis.
- Empty/zero data renders an `EmptyChart` ("Not enough data yet.").
- `FunnelInsight` is CSS-only (no recharts) so it stays crisp at any width; each
  row shows the stage label, formatted value, and **per-step conversion** — the
  stage's value as a % of the *previous* stage (standard funnel semantics). The
  first row shows no %, a zero-value predecessor renders "—", and >100% is
  possible when a later stage's value legitimately exceeds the prior stage's.
  It is consumed by both `dashboard/page.tsx` and
  `opportunities/page.tsx` (the "Conversion funnel (by value)" card).

The `Point` type (`{ label: string; value: number }`) and the `ChartFormat`
enum (`"number" | "currency"`) are exported from this module; `analytics.ts`
imports the `Point` type to type its helper return values.

## BI export

Gated by `canViewFinance` — several datasets carry revenue and commission
figures. Served by `GET /api/export/[entity]`
(`src/app/api/export/[entity]/route.ts`, `runtime = "nodejs"`); the UI lives at
the `/reports` **Export data** section (`ReportsExport`,
`src/components/reports/reports-export.tsx`).

### Endpoints

```
GET /api/export/clients?format=csv
GET /api/export/bookings?format=xlsx&from=2026-01-01&to=2026-06-30
GET /api/export/workbook?format=xlsx          # all datasets, one workbook
```

- `format` — `csv` or `xlsx` (default `xlsx`). `workbook` is Excel-only.
- `from` / `to` — optional ISO dates; invalid values are ignored. The range
  filters by each dataset's creation date (`createdAt`) where one exists.
- Non-finance roles get `403`; an unknown entity gets `404`.
- Filenames are stamped with the export date, e.g.
  `bookings-2026-07-01.xlsx`, `atlas-export-2026-07-01.xlsx`.

### Datasets (`src/lib/export/datasets.ts`)

Each dataset is agency-scoped and produces a uniform `{ columns, rows }` shape
consumed by both writers. Every controlled/enum field is emitted as **both** a
stable `*_code` column (for pivots/joins in Power BI or SQL) **and** a
human-readable `*_label` column; amounts are in DZD, dates are ISO
(`YYYY-MM-DD`).

| Key | Label | Financial | Source |
|---|---|---|---|
| `clients` | Clients | no | `client` (+ owner name) |
| `opportunities` | Opportunities | no | `opportunity` (+ client, assignee) |
| `bookings` | Bookings | **yes** | `booking` (+ payments → paid/balance via `paymentSummary`) |
| `booking_items` | Booking items | **yes** | `bookingItem` ⋈ `booking` |
| `travellers` | Travellers | no | `bookingTraveller` ⋈ `booking` |
| `payments` | Payments | **yes** | `payment` ⋈ `booking` |
| `commissions` | Commissions | **yes** | `commission` (+ booking, supplier, agent) |
| `suppliers` | Suppliers | no | `supplier` |

`DATASETS` is the server registry (`DATASET_KEYS` = its keys); the export UI
mirrors it as a small hand-maintained list. The `financial` flag documents which
datasets carry revenue/commission data — access to the whole endpoint is already
restricted to `canViewFinance` roles.

### Writers

- **CSV** (`src/lib/export/csv.ts`) — minimal RFC-4180 writer. Prepends a UTF-8
  BOM so Excel opens accented text (é, ç, ü) correctly, quotes any field
  containing `"`, `,`, or a newline, and joins rows with `\r\n`. Power-BI
  friendly.
- **XLSX** (`src/lib/export/xlsx.ts`) — builds a workbook via **exceljs**
  (`exceljs@^4.4.0`, Node-only). One sheet per dataset; header row bold and
  frozen (`ySplit: 1`), columns widened to 20, sheet names sanitized to Excel's
  31-char / reserved-char limits. The `workbook` entity emits every dataset as
  its own sheet in a single file.
