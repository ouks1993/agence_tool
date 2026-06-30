import { DEFAULT_CURRENCY } from "@/lib/domain";

/** Formats a monetary amount (number or numeric-string) as a currency string. */
export function formatMoney(
  amount: number | string | null | undefined,
  currency: string = DEFAULT_CURRENCY
): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount ?? 0;
  const safe = Number.isFinite(value) ? (value as number) : 0;
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    // Unknown currency code — fall back to a plain number with the code suffixed.
    return `${safe.toFixed(2)} ${currency}`;
  }
}

/**
 * Compact money for KPI tiles, e.g. 42_800_000 -> "42.8M DZD". Keeps figures
 * dense on dashboard cards where the precise value lives in a tooltip/export.
 * No FX — the caller is responsible for passing a single-currency total.
 */
export function formatMoneyCompact(
  amount: number | string | null | undefined,
  currency: string = DEFAULT_CURRENCY
): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount ?? 0;
  const safe = Number.isFinite(value) ? (value as number) : 0;
  const compact = new Intl.NumberFormat("en-GB", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(safe);
  return `${compact} ${currency}`;
}

/** Short date, e.g. "12 Aug 2026". Accepts Date | string | null. */
export function formatDate(
  date: Date | string | null | undefined
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Relative time, e.g. "3 hours ago". */
export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = d.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minutes = Math.round(abs / 60000);
  if (minutes < 60) return rtf.format(Math.round(diffMs / 60000), "minute");
  const hours = Math.round(abs / 3600000);
  if (hours < 24) return rtf.format(Math.round(diffMs / 3600000), "hour");
  const days = Math.round(abs / 86400000);
  if (days < 30) return rtf.format(Math.round(diffMs / 86400000), "day");
  const months = Math.round(days / 30);
  if (months < 12) return rtf.format(-months, "month");
  return rtf.format(-Math.round(months / 12), "year");
}

/** Date formatted for an <input type="date"> value (yyyy-mm-dd). */
export function toDateInputValue(
  date: Date | string | null | undefined
): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Minutes to a compact duration, e.g. 330 -> "5h 30m". */
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ") || "0m";
}

/** Time portion of an ISO datetime, e.g. "14:05". */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export type PassportStatus = {
  level: "ok" | "warning" | "expired" | "unknown";
  message: string;
};

/**
 * Checks a passport expiry against a travel date. Most countries require a
 * passport to be valid for at least 6 months beyond the date of travel.
 */
export function passportExpiryStatus(
  expiry: Date | string | null | undefined,
  travelDate: Date | string | null | undefined
): PassportStatus {
  if (!expiry) return { level: "unknown", message: "No passport expiry on file" };
  const exp = typeof expiry === "string" ? new Date(expiry) : expiry;
  if (Number.isNaN(exp.getTime())) {
    return { level: "unknown", message: "No passport expiry on file" };
  }
  const ref = travelDate
    ? typeof travelDate === "string"
      ? new Date(travelDate)
      : travelDate
    : new Date();
  if (exp.getTime() <= ref.getTime()) {
    return { level: "expired", message: `Passport expires ${formatDate(exp)} — before/at travel` };
  }
  const sixMonths = new Date(ref);
  sixMonths.setMonth(sixMonths.getMonth() + 6);
  if (exp.getTime() < sixMonths.getTime()) {
    return {
      level: "warning",
      message: `Passport expires ${formatDate(exp)} — under 6 months after travel`,
    };
  }
  return { level: "ok", message: `Valid until ${formatDate(exp)}` };
}

/** Initials from a name, e.g. "Yasmine B." -> "YB". */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
