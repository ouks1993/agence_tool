# UI / UX

> **Source of truth:** [`DESIGN.md`](../DESIGN.md) defines the full visual design
> system — colors (oklch tokens), typography, spacing, radius, shadows,
> animations, layout patterns, shadcn/ui component conventions, and dark mode. All
> new components and pages **must** follow it. This doc points there and captures
> product-level UX patterns only; it does not duplicate the token tables.

## Atlas design principles

The product guardrails every page and feature is measured against:

1. **Never ask the user twice for the same information.** Reuse what's already
   captured (controlled vocabularies, reference data, client records) instead of
   re-prompting.
2. **Everything starts from the client.** The client record is the spine — leads,
   opportunities, proposals, bookings and payments all hang off it.
3. **Every action must be reversible.** Prefer soft states, confirmations and undo
   over destructive, irreversible operations.
4. **One source of truth.** No duplicated or conflicting data; canonical values
   (ISO countries, enums, references unique per agency) over free text.
5. **Automation before manual work.** Default to generating (commissions,
   itineraries, quotes, documents) rather than asking the user to do it by hand.
6. **Every page should answer "What should I do next?"** Surface the next action —
   stepper advance, CTA, empty-state prompt — never leave a dead end.
7. **Managers want insights; agents want speed.** Tailor each role's surface —
   analytics-dense for managers, fast and scoped for agents.
8. **No empty pages.** Every list/chart/detail has an empty state with a clear
   next step, never blank space.
9. **Data quality is more important than flexibility.** Constrain inputs
   (dropdowns, pickers, validation) to keep reporting clean.
10. **Everything should be mobile friendly.** Layouts work on small screens and in
    both LTR and RTL.

These principles inform the patterns below and the
[business rules](business-rules.md). See also the product
[vision](vision.md).

## Design system summary

- **Stack:** Next.js + Tailwind v4 (CSS-first `@theme inline`, no config file),
  shadcn/ui (new-york, neutral), Lucide icons, Geist fonts, next-themes dark mode.
- **Tokens:** semantic oklch color tokens, `--radius` 10px base, Tailwind-default
  shadows, custom `fade-in`/`fade-up`/`scale-in` animations. Use `cn()` for class
  merging.
- See [`DESIGN.md`](../DESIGN.md) for every value.

## Product UX patterns

These are app-specific patterns layered on the design system:

- **Getting-started checklist** — dismissible 4-step card on the dashboard for new
  agencies; dismissed state persists in DB (`agency.onboardingDismissedAt`) across
  devices and team members.
- **Lifecycle stepper** — horizontal progress bar on booking detail with an
  "Advance to [next]" button and soft/hard prerequisite guards (see
  [business-rules.md](business-rules.md#booking-lifecycle)).
- **Role-gated nav** — locked nav items shown dimmed with a tooltip for non-admin
  roles; nav is filtered by a `show(role)` predicate.
- **List/Board toggle** — Bookings and Pipeline share data with a table↔kanban
  switch.
- **Inline search sheet** — "Search flights/hotels" on the trip-services panel
  opens a sheet pre-scoped to the booking's destination.
- **Consolidated sharing** — proposal sharing lives under one "Share with client ▾"
  dropdown.
- **Empty states** — charts and lists show empty-state badges/CTAs rather than
  blank space.

## RTL & i18n

Arabic is RTL (IBM Plex Sans Arabic, `html[dir="rtl"]`). Layout must work in both
directions. i18n plumbing is in [architecture.md](architecture.md#internationalization).
