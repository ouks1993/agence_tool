# Decision 0005 — Marketing-grade UI redesign of the live app

**Date:** 2026-06-29
**Status:** accepted
**Deciders:** Owner (product), Engineering

## Context

A premium sales deck and a set of high-fidelity UI mockups were produced under
`marketing/` (deck `marketing/index.html`, 11 screens in `marketing/mockups/`,
target design language in `marketing/DESIGN-RECOMMENDATIONS.md`). The mockups are
idealized, fully-populated renders of how Atlas should look at its best.

The live app at `agencetool.vercel.app` does **not** match them. The gap is not
in the shell — the live app already has the dark "Atlas · Travel Desk" sidebar,
the same nav groups and branding — but in the **page content**: the live screens
use the baseline shadcn/neutral system with sparse real data and plain empty
states, while the mockups show rich spacing, custom charts, populated tables, and
a more premium visual treatment.

Showing prospects the deck and then the live app creates a credibility gap. The
owner has chosen to close it by **bringing the live product up to the deck**, not
by tempering the deck.

## Decision

Undertake a **full, phased visual/UX redesign of the live application** to the
marketing-grade standard set by the deck and
`marketing/DESIGN-RECOMMENDATIONS.md`. The work ships incrementally to production,
one phase at a time. The phased plan lives at
[`specs/ui-redesign/PLAN.md`](../../specs/ui-redesign/PLAN.md).

## Reasoning

- **Feature-filter rule** (`AGENTS.md`) is satisfied:
  - *Increases booking conversion* — a more polished proposal builder, portal,
    and quoting flow makes more proposals become bookings.
  - *Increases agency retention* — a product that looks and feels premium is one
    the agency is prouder to use daily and slower to leave.
- **Honest selling** — what the prospect sees in a demo should be what they buy.
- **Foundation already exists** — the deck, the 11 mockups, the canonical demo
  dataset (`marketing/demo-data.json`) and the design guide give a concrete,
  agreed target, so the redesign is execution against a spec, not exploration.
- **Phased, not a rewrite** — each phase is a visual/UX upgrade of existing
  screens that **preserves all current functionality, routes, and server
  actions**. No business logic is rewritten to change the look.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Make the deck honest (rebuild it around real screenshots) | Fastest, but caps the product at today's polish and abandons the agreed target. |
| Seed rich demo data only | Closes the "looks empty" gap but not the visual-polish gap; folded into the redesign as Phase 0 instead. |
| Polish only a few hero screens | Higher leverage short-term, but the owner wants the whole app brought up; hero screens are simply Phase 1 here. |
| Big-bang redesign | Too risky for a live multi-tenant product; phased delivery keeps production stable. |

## Consequences

**Easier / better**
- The product matches the sales narrative; demos are honest.
- `DESIGN.md` becomes a richer, marketing-grade design system as Phase 0 lands,
  benefiting every future screen.
- New reusable primitives (KPI/stat cards, chart components, populated empty
  states, skeletons) are built once and reused everywhere.

**Harder / trade-offs**
- Sustained multi-phase effort touching most screens.
- `DESIGN.md` must be kept in lockstep as tokens/components evolve (the design
  mockups are the *target*, but `DESIGN.md` stays the in-code source of truth).
- The marketing mockups are standalone HTML, not Next.js/shadcn — they are a
  **visual target to match, not code to copy**.

## Related

- [`specs/ui-redesign/PLAN.md`](../../specs/ui-redesign/PLAN.md) — the phased plan
- `marketing/DESIGN-RECOMMENDATIONS.md` — target design language (Deliverable 4)
- `marketing/index.html` + `marketing/mockups/*.html` — the visual targets
- `marketing/demo-data.json` — canonical demo dataset for populating screens
- `DESIGN.md` — current in-code design system (evolves with Phase 0)
- [roadmap.md](../roadmap.md) — initiative + module status
