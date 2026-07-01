import Link from "next/link";
import { Download, MessageCircle, Plane } from "lucide-react";

/**
 * The branded "your next trip" hero card. Presentational only — every value is
 * derived server-side from real booking data and passed in. Action buttons are
 * rendered as affordances that link to real destinations only. Each CTA href is
 * passed in explicitly by the host page (booking-detail sections, the share
 * link, the support card) so no button is ever a dead anchor; a CTA is omitted
 * entirely when its destination does not exist.
 */

export type TripHeroMeta = { label: string; value: string };

export function TripHero({
  eyebrow,
  statusLabel,
  title,
  subParts,
  meta,
  countdownDays,
  countdownFoot,
  packHref,
  itineraryHref,
  supportHref,
  agentName,
}: {
  eyebrow: string;
  statusLabel: string;
  title: string;
  /** e.g. ["2 Aug — 9 Aug 2026", "7 nights", "2 travellers"] */
  subParts: string[];
  meta: TripHeroMeta[];
  /** Whole days until departure, or null when unknown/past. */
  countdownDays: number | null;
  /** Small caption under the countdown (e.g. formatted depart date). */
  countdownFoot?: string | undefined;
  /** Real destination for the "travel pack" CTA (booking documents section). */
  packHref?: string | undefined;
  /** Real itinerary destination — booking detail or the share link. */
  itineraryHref?: string | undefined;
  /** Real destination for the "message agent" CTA (support section/mailto). */
  supportHref?: string | undefined;
  agentName?: string | undefined;
}) {
  const hasActions = Boolean(packHref || itineraryHref || supportHref);
  return (
    <section
      className="relative isolate mb-7 overflow-hidden rounded-xl border text-white shadow-lg"
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(14,21,37,0.18) 0%, rgba(14,21,37,0.72) 100%), linear-gradient(125deg, #1B2239 0%, var(--brand) 58%, #1FA2C7 120%)",
      }}
    >
      {/* Decorative ocean glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(120% 90% at 88% -10%, rgba(255,255,255,0.16) 0%, transparent 42%), radial-gradient(70% 60% at 12% 120%, rgba(31,162,199,0.40) 0%, transparent 55%)",
        }}
      />

      <div className="grid grid-cols-1 items-start gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto]">
        <div>
          <span className="inline-flex items-center gap-2 text-[11.5px] font-semibold tracking-[0.08em] text-white/80 uppercase">
            {eyebrow}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-2.5 py-0.5 text-[11px] backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-white" />
              {statusLabel}
            </span>
          </span>

          <h2 className="mt-3.5 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            {title}
          </h2>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/85">
            {subParts.map((part, i) => (
              <span key={i} className="flex items-center gap-3">
                {i > 0 && <span className="text-white/40">•</span>}
                {part}
              </span>
            ))}
          </div>

          {meta.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4">
              {meta.map((m) => (
                <div key={m.label}>
                  <div className="text-[11px] font-semibold tracking-[0.06em] text-white/65 uppercase">
                    {m.label}
                  </div>
                  <div className="mt-1 text-[15px] font-semibold text-white">
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {countdownDays !== null && (
          <div className="min-w-[184px] rounded-lg border border-white/25 bg-white/10 p-5 text-center backdrop-blur-sm">
            <div className="text-[11px] font-semibold tracking-[0.08em] text-white/80 uppercase">
              Departs in
            </div>
            <div className="mt-2 text-5xl leading-none font-bold tracking-tighter">
              {countdownDays}
            </div>
            <div className="mt-1 text-sm font-medium text-white/85">
              {countdownDays === 1 ? "day" : "days"}
            </div>
            {countdownFoot && (
              <div className="mt-3.5 border-t border-white/20 pt-3 text-xs text-white/85">
                {countdownFoot}
              </div>
            )}
          </div>
        )}

        {hasActions && (
          <div className="col-span-full flex flex-wrap gap-2.5 border-t border-white/15 pt-5">
            {packHref && (
              <Link
                href={packHref}
                className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              >
                <Download className="size-4" />
                Travel documents
              </Link>
            )}
            {itineraryHref && (
              <Link
                href={itineraryHref}
                className="inline-flex items-center gap-2 rounded-md border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              >
                <Plane className="size-4" />
                View full itinerary
              </Link>
            )}
            {supportHref && (
              <a
                href={supportHref}
                className="inline-flex items-center gap-2 rounded-md border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              >
                <MessageCircle className="size-4" />
                {agentName
                  ? `Message ${agentName.split(/\s+/)[0]}`
                  : "Message agent"}
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
