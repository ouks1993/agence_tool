"use client";

/**
 * Lightweight, on-brand chart primitives built directly on recharts and the
 * design system's --chart-* / --popover tokens. Server pages compute the data
 * and pass plain {label, value} arrays; these client components render them.
 *
 * NOTE: props are all serializable (no function props) so these can be rendered
 * directly from Server Components. Formatting is selected via the `format` enum.
 */
import { BarChart3 } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type Point = { label: string; value: number };
export type ChartFormat = "number" | "currency";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

const colorAt = (i: number): string =>
  CHART_COLORS[i % CHART_COLORS.length] ?? "var(--chart-1)";

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  color: "var(--popover-foreground)",
  fontSize: "12px",
  padding: "6px 10px",
} as const;

const axisTick = { fill: "var(--muted-foreground)", fontSize: 11 } as const;

/** Builds a serializable-safe formatter from a format enum (computed on the client). */
function makeFormatter(
  format: ChartFormat,
  currency: string
): (n: number) => string {
  if (format === "currency") {
    const nf = new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
    return (n) => nf.format(n);
  }
  return (n) => n.toLocaleString();
}

/**
 * Builds a *compact* formatter for AXIS TICKS only — 7-8 digit currency ticks
 * ("1,200,000") overflow the default YAxis width and render clipped ("00,000").
 * Compact notation keeps ticks short ("1.2m", "600k") while tooltips keep full
 * precision via `makeFormatter`. Small integers stay unchanged.
 *
 * Lowercased ("m"/"k") to match the app's dense axis style. Currency ticks are
 * kept unit-less (no code/symbol) — the axis header/tooltip already carry the
 * currency, and a suffix would re-introduce the width overflow this fixes.
 */
function makeAxisTickFormatter(
  _format: ChartFormat,
  _currency: string
): (n: number) => string {
  // Both `currency` and `number` axes get the same unit-less compact treatment:
  // ticks intentionally drop the currency code/symbol (the axis/tooltip already
  // carry it) so 7-8 digit values no longer overflow the YAxis width. The params
  // are kept to mirror `makeFormatter`'s signature and stay call-site symmetric.
  const compact = new Intl.NumberFormat("en", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  });
  return (n) => {
    if (!Number.isFinite(n)) return "";
    // Small values render plainly (compact leaves them as-is, e.g. "600"); the
    // lowercase pass only affects the "K"/"M"/"B" suffix on large values.
    return compact.format(n).toLowerCase();
  };
}

/** Vertical bar chart — good for "bookings by country", "team performance". */
export function BarInsight({
  data,
  height = 240,
  color = "var(--chart-1)",
  format = "number",
  currency = "DZD",
}: {
  data: Point[];
  height?: number;
  color?: string;
  format?: ChartFormat;
  currency?: string;
}) {
  const fmt = makeFormatter(format, currency);
  const tickFmt = makeAxisTickFormatter(format, currency);
  if (data.length === 0) {
    return <EmptyChart height={height} />;
  }
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval={0} />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={tickFmt}
          />
          <Tooltip
            cursor={{ fill: "var(--accent)", opacity: 0.4 }}
            contentStyle={tooltipStyle}
            formatter={(value) => fmt(Number(value))}
          />
          <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={56} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Donut chart — good for "bookings by status", "margin by product type".
 *
 * Optional `centerValue` / `centerLabel` render a headline figure in the ring's
 * hole (e.g. a blended total). Each legend row can carry a `meta` sub-line and a
 * `share` percentage (shown as the bold right-hand value) — matching the deck's
 * donut legend. When `share` is provided the legend value is the share; the raw
 * value is used for the tooltip only.
 */
export type DonutSlice = Point & { meta?: string; share?: number };

export function DonutInsight({
  data,
  height = 240,
  format = "number",
  currency = "DZD",
  centerValue,
  centerLabel,
}: {
  data: DonutSlice[];
  height?: number;
  format?: ChartFormat;
  currency?: string;
  centerValue?: string;
  centerLabel?: string;
}) {
  const fmt = makeFormatter(format, currency);
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <EmptyChart height={height} />;
  }
  return (
    <div style={{ height }} className="flex w-full items-center gap-5">
      <div className="relative h-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => fmt(Number(value))}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="var(--background)"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colorAt(i)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {centerValue && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold tracking-tight tabular-nums">
              {centerValue}
            </span>
            {centerLabel && (
              <span className="text-muted-foreground text-[11px]">{centerLabel}</span>
            )}
          </div>
        )}
      </div>
      <ul className="flex flex-1 flex-col gap-2.5 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className="grid grid-cols-[12px_1fr_auto] items-center gap-2.5">
            <span
              className="size-3 shrink-0 rounded-[3px]"
              style={{ backgroundColor: colorAt(i) }}
            />
            <span className="min-w-0">
              <span className="block truncate font-medium">{d.label}</span>
              {d.meta && (
                <span className="text-muted-foreground block truncate text-[11px]">
                  {d.meta}
                </span>
              )}
            </span>
            <span className="font-semibold tabular-nums">
              {d.share !== undefined ? `${d.share}%` : fmt(d.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Area trend — good for "bookings/revenue over time". */
export function AreaInsight({
  data,
  height = 240,
  color = "var(--chart-2)",
  format = "number",
  currency = "DZD",
}: {
  data: Point[];
  height?: number;
  color?: string;
  format?: ChartFormat;
  currency?: string;
}) {
  const fmt = makeFormatter(format, currency);
  const tickFmt = makeAxisTickFormatter(format, currency);
  if (data.length === 0) {
    return <EmptyChart height={height} />;
  }
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval={0} />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={tickFmt}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => fmt(Number(value))} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill="url(#areaFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars — good for long labels ("top destinations/clients/suppliers"). */
export function HBarInsight({
  data,
  height = 240,
  color = "var(--chart-1)",
  format = "number",
  currency = "DZD",
}: {
  data: Point[];
  height?: number;
  color?: string;
  format?: ChartFormat;
  currency?: string;
}) {
  const fmt = makeFormatter(format, currency);
  const tickFmt = makeAxisTickFormatter(format, currency);
  if (data.length === 0) {
    return <EmptyChart height={height} />;
  }
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={tickFmt} />
          <YAxis
            type="category"
            dataKey="label"
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={120}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: "var(--accent)", opacity: 0.4 }}
            contentStyle={tooltipStyle}
            formatter={(value) => fmt(Number(value))}
          />
          <Bar dataKey="value" fill={color} radius={[0, 6, 6, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Funnel — stacked horizontal stage bars that shrink as the pipeline narrows.
 * Each row shows the stage label, value, and *step* conversion: the percentage
 * of the PREVIOUS stage's value that reached this stage (standard funnel
 * semantics). The first row shows no % (nothing precedes it). A stage can
 * legitimately convert above 100% when its value grows vs the prior stage, so
 * the figure is not capped — it stays truthful. When the previous stage is 0
 * (division undefined) the cell renders "—".
 *
 * Bar widths remain proportional to the max value across all stages. Pure CSS
 * bars (no recharts) so it stays crisp at any width.
 */
export function FunnelInsight({
  data,
  format = "number",
  currency = "DZD",
}: {
  data: Point[];
  format?: ChartFormat;
  currency?: string;
}) {
  const fmt = makeFormatter(format, currency);
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <EmptyChart height={200} />;
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex w-full flex-col gap-2">
      {data.map((d, i) => {
        const widthPct = Math.max((d.value / max) * 100, 4);
        const prev = i > 0 ? data[i - 1]?.value ?? 0 : 0;
        // First row: no prior stage → no %. Prior value 0 → undefined ratio → "—".
        const convLabel =
          i === 0 ? "—" : prev === 0 ? "—" : `${Math.round((d.value / prev) * 100)}%`;
        return (
          <div key={d.label} className="flex items-center gap-3">
            <span className="text-muted-foreground w-28 shrink-0 truncate text-xs">
              {d.label}
            </span>
            <div className="bg-muted h-7 flex-1 overflow-hidden rounded-md">
              <div
                className="flex h-full items-center justify-end rounded-md px-2"
                style={{ width: `${widthPct}%`, backgroundColor: colorAt(i) }}
              >
                <span className="text-xs font-medium text-white/95">{fmt(d.value)}</span>
              </div>
            </div>
            <span className="text-muted-foreground w-10 shrink-0 text-right text-xs">
              {convLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Tiny inline sparkline (no axes/tooltip) for KPI-card micro-trends. Renders a
 * trailing series as a single smoothed stroke; stroke colour is chosen by the
 * caller (up→success, down→danger) so it reads at a glance. Pure SVG, no deps.
 */
export function SparkLine({
  data,
  color = "var(--chart-1)",
  width = 64,
  height = 24,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const pts = data.filter((n) => Number.isFinite(n));
  if (pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const stepX = width / (pts.length - 1);
  const pad = 2;
  const usable = height - pad * 2;
  const d = pts
    .map((v, i) => {
      const x = i * stepX;
      const y = pad + usable - ((v - min) / span) * usable;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      fill="none"
      aria-hidden
    >
      <path
        d={d}
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EmptyChart({
  height,
  hint = "Data appears here once bookings and proposals land in this window.",
}: {
  height: number;
  hint?: string;
}) {
  return (
    <div
      style={{ height }}
      className="text-muted-foreground flex w-full flex-col items-center justify-center gap-3 text-center"
    >
      <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full">
        <BarChart3 className="size-5" />
      </span>
      <div className="space-y-0.5">
        <p className="text-foreground text-sm font-medium">Not enough data yet</p>
        <p className="mx-auto max-w-[15rem] text-xs">{hint}</p>
      </div>
    </div>
  );
}
