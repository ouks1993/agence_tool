# Decision 0001 — Navigation IA restructure

**Date:** 2026-06-28
**Status:** accepted
**Deciders:** Product owner + CTO review

## Context

Atlas had 15 flat navigation items in an order that contradicted the golden
workflow (Finance appeared above Clients; Opportunities was entirely missing from
the nav; Search and Hotels were two separate items for the same user task; Operations
was a duplicate of the Bookings board view). An IA audit (docs/owner-ia-audit.md)
identified these as P0/P1 usability issues.

## Decision

Restructure navigation into 5 labelled sections following the golden workflow:
**WORK** (Clients → Pipeline → Proposals → Bookings) · **SOURCING** (Flights ·
Hotels) · **FINANCE** · **TOOLS** · **ADMIN**. Rename `/products` → `/proposals`
canonically (URL rewrite). Retire Operations as a nav item. Create
`/sourcing/flights` as a dedicated page.

## Reasoning

- Section-grouped nav reduces cognitive load from 15 flat items to 4-5 scannable groups
- Workflow order (Clients first, Finance last) matches how agents think
- Sourcing section scales cleanly to Cars, Cruises, Packages without nav restructure
- `/proposals` label matches what agents, clients and every competitor call the concept
- Operations was a duplicate of the Bookings board toggle — removing it eliminates confusion

## Alternatives considered

| Option | Why rejected |
|---|---|
| Keep flat nav, just reorder | Doesn't solve the 15-item cognitive load or the Search/Hotels duplication |
| Merge Search + Hotels into one page | Reasonable but defers the Sourcing section scaling problem |
| Rename Operations → Pipeline | The real pipeline is Opportunities; Operations was a board view, not a pipeline |

## Consequences

- Easier: adding new sourcing verticals (Cars, Cruises) — one line in NAV_SECTIONS
- Easier: onboarding new agents — nav reads like the job
- Harder: old `/products` and `/search` bookmarks need redirects (added to next.config.ts)
- Old URLs preserved via 301 redirects (products) and 307 redirects (search, hotels, operations)

## Related

- docs/owner-ia-audit.md (full IA analysis)
- src/components/app/app-shell.tsx (implementation)
- next.config.ts (rewrites + redirects)
- src/app/(app)/sourcing/flights/page.tsx (new page)
