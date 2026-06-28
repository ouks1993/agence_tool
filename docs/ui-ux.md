# UI / UX

> **Source of truth:** [`DESIGN.md`](../DESIGN.md) defines the full visual design
> system — colors (oklch tokens), typography, spacing, radius, shadows,
> animations, layout patterns, shadcn/ui component conventions, and dark mode. All
> new components and pages **must** follow it. This doc points there and captures
> product-level UX patterns only; it does not duplicate the token tables.

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
