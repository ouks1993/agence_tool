# Decision 0002 — Agency Network is a Stage 3 Direction

**Date:** 2026-06-28
**Status:** accepted (direction), deferred (implementation)
**Deciders:** Founding team + board

## Context

Board feedback on the strategic audit introduced the concept of Atlas as
infrastructure connecting agencies to each other, not just software serving agencies
individually. Agency A cannot fulfil a complex request; Atlas surfaces Agency B —
a specialist — who can. Revenue sharing, inventory exchange, trusted subcontractor
relationships, shared local suppliers. Network effects from participant relationships,
not code.

This was not in the original strategic audit and represents a meaningfully stronger
moat than data accumulation alone. Network effects in B2B do not decay; an agency
earning revenue through Atlas referrals will not leave the platform.

## Decision

Name this as the Stage 3 strategic direction. Begin designing for it in the data
model now at minimal cost. Delay the product surface until Atlas has 300+ agencies
(Stage 3 threshold).

## Reasoning

Network effects require critical mass before generating value. At 50 agencies,
the network is too thin for meaningful referral flow. Building the product surface
before critical mass exists creates engineering overhead without corresponding user
value and fragments attention from the supplier booking and automation work that
must happen first to reach the scale where the network becomes possible.

Designing for it in the data model costs almost nothing. Agency records should
carry specialisation attributes, destination expertise tags, and capacity signals
from the beginning — these enable future matching without requiring a current
product surface.

## What this means now (Stage 1–2)

- Agency schema should include `specialisations`, `destinations_served`, and
  `agency_type` as structured fields (not free text) to enable future matching
- Activity and booking data should be structured to allow anonymised capability
  inference over time
- Do not build any product surface for inter-agency connection yet
- Do not market this capability yet — announcing a network that does not exist
  creates expectation debt

## What this means at Stage 3 (300+ agencies)

- Surface: "Agency B specialises in this destination and has capacity"
- Revenue sharing mechanism for fulfilled referrals
- Trusted subcontractor relationships formalised in the platform
- Inventory and resource exchange between agencies

## Alternatives considered

| Option | Why deferred/rejected |
|---|---|
| Build the network now | Critical mass is required; building before scale creates overhead without value |
| Never build the network | This is the strongest long-term moat available; intentionally deferring is different from discarding |
| Build it as a marketplace immediately | Marketplace dynamics require both sides; agencies are not yet numerous enough to form a functioning marketplace |

## Consequences

- Stronger: when Atlas reaches 300 agencies, the network surface can be activated
  on data infrastructure already in place
- Harder: resisting the temptation to build this early when it is clearly a good idea
- Unchanged: no current engineering work required beyond schema attributes

## Related

- docs/strategic-audit.md — the original moat analysis this extends
- docs/strategy-board-response.md — the board feedback that introduced this direction
- docs/domain.md — agency entity where specialisation attributes should be added
