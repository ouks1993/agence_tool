"use client";

/**
 * Lightweight, on-brand chart primitives built directly on recharts and the
 * design system's --chart-* / --popover tokens. Server pages compute the data
 * and pass plain {label, value} arrays; these client components render them.
 *
 * NOTE: props are all serializable (no function props) so these can be rendered
 * directly from Server Components. Formatting is selected via the `format` enum.
 */
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
            width={48}
            tickFormatter={fmt}
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

/** Donut chart — good for "bookings by status", "payments by method". */
export function DonutInsight({
  data,
  height = 240,
  format = "number",
  currency = "DZD",
}: {
  data: Point[];
  height?: number;
  format?: ChartFormat;
  currency?: string;
}) {
  const fmt = makeFormatter(format, currency);
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <EmptyChart height={height} />;
  }
  return (
    <div style={{ height }} className="flex w-full items-center gap-4">
      <div className="h-full flex-1">
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
              innerRadius="58%"
              outerRadius="85%"
              paddingAngle={2}
              stroke="var(--background)"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colorAt(i)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-1 flex-col gap-1.5 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colorAt(i) }}
            />
            <span className="text-muted-foreground truncate">{d.label}</span>
            <span className="ml-auto font-medium">{fmt(d.value)}</span>
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
            width={48}
            tickFormatter={fmt}
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
          <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={fmt} />
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
 * Each row shows the stage label, value, and conversion vs the first stage.
 * Pure CSS bars (no recharts) so it stays crisp at any width.
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
  const top = data[0]?.value || 1;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex w-full flex-col gap-2">
      {data.map((d, i) => {
        const widthPct = Math.max((d.value / max) * 100, 4);
        const convPct = Math.round((d.value / top) * 100);
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
              {i === 0 ? "—" : `${convPct}%`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function EmptyChart({ height }: { height: number }) {
  return (
    <div
      style={{ height }}
      className="text-muted-foreground flex w-full items-center justify-center text-sm"
    >
      Not enough data yet.
    </div>
  );
}
