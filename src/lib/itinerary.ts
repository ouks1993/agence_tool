/**
 * Builds a day-by-day itinerary model from a booking's dates, items and
 * day-notes. Pure function — shared by the agent builder and the public view.
 */

export type ItineraryItem = {
  id: string;
  type: string;
  title: string;
  supplier: string | null;
  startDate: Date | string | null;
  amount: string;
  currency: string;
  confirmationNumber: string | null;
  dayIndex: number | null;
};

export type ItineraryDay = {
  dayIndex: number;
  date: Date | null;
  title: string | null;
  notes: string | null;
  items: ItineraryItem[];
};

const DAY_MS = 86400000;

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function buildItinerary(opts: {
  departDate: Date | string | null;
  returnDate: Date | string | null;
  items: ItineraryItem[];
  dayRows: { dayIndex: number; title: string | null; notes: string | null }[];
}): { days: ItineraryDay[]; unscheduled: ItineraryItem[] } {
  const depart = toDate(opts.departDate);
  const ret = toDate(opts.returnDate);

  let dayCount = 0;
  if (depart && ret) {
    dayCount = clamp(Math.round((startOfDay(ret) - startOfDay(depart)) / DAY_MS) + 1, 1, 60);
  } else if (depart) {
    dayCount = 1;
  } else {
    const maxIdx = opts.items.reduce(
      (m, i) => (i.dayIndex != null && i.dayIndex > m ? i.dayIndex : m),
      -1
    );
    dayCount = maxIdx + 1;
  }

  const noteMap = new Map(opts.dayRows.map((d) => [d.dayIndex, d]));
  const days: ItineraryDay[] = [];
  for (let i = 0; i < dayCount; i++) {
    const note = noteMap.get(i);
    days.push({
      dayIndex: i,
      date: depart ? new Date(startOfDay(depart) + i * DAY_MS) : null,
      title: note?.title ?? null,
      notes: note?.notes ?? null,
      items: [],
    });
  }

  const unscheduled: ItineraryItem[] = [];
  for (const item of opts.items) {
    let idx = item.dayIndex;
    if (idx == null && depart) {
      const s = toDate(item.startDate);
      if (s) {
        const d = Math.round((startOfDay(s) - startOfDay(depart)) / DAY_MS);
        if (d >= 0 && d < dayCount) idx = d;
      }
    }
    if (idx != null && idx >= 0 && idx < days.length) days[idx]!.items.push(item);
    else unscheduled.push(item);
  }

  return { days, unscheduled };
}
