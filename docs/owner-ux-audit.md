# Owner's-Eye UX Audit

**Date:** 2026-06-28 · **Lens:** "I own this travel agency and use Atlas all day."
Walking every workflow looking for friction. **Recommendations only — nothing
implemented.**

How to read severity: **P0** = trips me up daily / costs real time · **P1** =
recurring annoyance · **P2** = polish.

---

## Top findings (prioritized)

| # | Issue | Sev | Why it hurts |
|---|---|---|---|
| 1 | **Opportunities page is orphaned from the nav** | P0 | My core sales list isn't in the sidebar; I can only reach deals via a client or the "Operations" board. I lose my pipeline. |
| 2 | **"Operations" is really the sales pipeline** | P0 | The label says fulfillment/ops; it's actually the deal board. I waste clicks hunting for where my pipeline lives — and it overlaps Opportunities + the Bookings board. |
| 3 | **Can't create a booking without first creating a client** | P0 | A walk-in/phone booking forces me to stop, go create a client, come back. Two screens for one sale. |
| 4 | **Nav order contradicts daily work** | P1 | Finance/Commissions/Reports sit *above* Bookings/Clients. My most-used screens are buried under money screens I open weekly. |
| 5 | **Three money destinations** (Finance, Commissions, Reports) | P1 | I never know which to open for "how much did we make?" Overlapping, unlabeled difference. |
| 6 | **Fragmented sourcing** (Search vs Hotels vs Assistant vs inline) | P1 | Four ways to look up inventory. I forget which finds what. |
| 7 | **Sales→Proposal is manual** | P1 | Won an opportunity? I re-enter trip details into a new proposal. Duplicated work. |
| 8 | **Inconsistent terminology** (Proposal/Product, Opportunity, Operations) | P2 | Same thing has different names across URL, page, and conversation. |
| 9 | **No nav grouping** (15 flat items) | P2 | A wall of links; no Sales / Ops / Finance / Admin sections to scan. |

---

## Workflow walkthroughs

### Finding new business → my pipeline (P0)

**What I see:** The sidebar has **Operations** (which opens a Pipeline kanban) but
**no Opportunities link** — even though there's a full `/opportunities` page. So my
deals live in two places with two names, and the "real" one isn't in the menu.

**Why it hurts:** My pipeline is the heartbeat of the agency. Making me guess
between "Operations" and a hidden Opportunities page costs clicks every single day
and makes the tool feel unfinished.

**Better workflow:** One nav item — **"Sales"** or **"Pipeline"** — that opens the
board with a list/board toggle (the toggle already exists on Bookings). Retire the
"Operations" name. One pipeline, one entry point.

### Taking a booking (P0)

**What I see:** On *New booking*, if the client doesn't exist I get "No clients
yet. Add a client first" — I must leave, create the client, and return.

**Why it hurts:** Half my bookings start as a phone call from someone not yet in the
system. The client-first rule is right for *data*, but it shouldn't be a *detour*.
That's two screens and a lost context switch for one sale.

**Better workflow:** Inline "＋ New client" inside the booking form (a quick
create that returns the new client selected), or a combined "New booking" that
captures a minimal client on the same screen. Create the client record *as a
side effect* of the sale, not a prerequisite step.

### Building the quote (P1)

**What I see:** I win an opportunity, then open *New proposal* and re-type the
destination, dates, and value I already captured on the opportunity. Convert
proposal→booking is one click (great) — but opportunity→proposal isn't.

**Why it hurts:** Re-entering the same trip details is duplicated work and a place
for transcription errors. It breaks the "never ask twice" principle right in the
middle of my money-making flow.

**Better workflow:** A **"Create proposal" button on the opportunity** that
pre-fills client, destination, dates, and value (the AI quote builder already
exists — wire it to the opportunity). Won → proposal in one click, mirroring
proposal → booking.

### Seeing the money (P1)

**What I see:** Finance, Commissions, and Reports are three separate nav items,
consecutive, with no stated difference.

**Why it hurts:** As the owner the #1 question is "how are we doing?" Three doors
for that answer means I learn-and-forget which is which.

**Better workflow:** Group them under one **"Finance"** section with sub-tabs
(Overview · Commissions · Export). One mental model, drill in for detail.

### Sourcing flights/hotels (P1)

**What I see:** A **Search** page, a separate **Hotels** module, the **Assistant**,
and an inline search sheet on the booking — four entry points.

**Why it hurts:** I can't form a habit. "Where do I price a hotel?" has four
answers depending on context.

**Better workflow:** Make the **in-booking search the primary path** (I'm almost
always sourcing *for a trip*), and frame standalone Search/Hotels as "explore
without a booking." Fold the Assistant's search into the same sheet.

---

## Terminology inconsistencies (P2)

Same concept, different words across URL / page title / everyday speech:

| Concept | URL | UI label | Agency speak | Fix |
|---|---|---|---|---|
| Quote/offer | `/products` | "Proposals" | "quote" / "proposal" | Rename route+code to `proposals`; pick one word everywhere. |
| Sales pipeline | `/operations` + `/opportunities` | "Operations" + (none) | "pipeline" / "deals" / "enquiries" | One name ("Pipeline"), one page. |
| Deal | `/opportunities` | "Opportunity" | often "enquiry" / "lead" | Confirm the agency's word; use it consistently. |

Mismatched names make training new staff slower and make the product feel stitched
together.

---

## Missing automation (P1 — productivity multipliers)

As an owner I want the system to do the obvious next step:

- New client → **welcome email** (not sent today)
- Opportunity won → **draft proposal** (manual today)
- Booking confirmed → **invoice** (on-demand PDF today)
- Travel completed → **review request** (not built)

Each is a manual chore I'll forget under load. These are the
[automation triggers](business-rules.md#automation-triggers) — building them is the
difference between a record-keeping tool and one that runs the agency.

---

## What already feels good (keep it)

- **Getting-started checklist** — I knew what to do on day one.
- **Booking lifecycle stepper** with "Advance to next" — I always know the state and
  the next action. This is exactly the "what do I do next?" principle done right.
- **Convert proposal → booking** in one click — more of this, please.
- **Client timeline** (activity + payments + notifications in one view) — this is
  how I think about a client.
- **Empty states with a CTA** — never a dead end.

---

## Recommended sequence

1. **Fix the pipeline confusion** (#1, #2) — rename/merge Operations + Opportunities
   into one "Pipeline" nav item. Cheap, high daily relief.
2. **Inline client create in booking** (#3) — removes the worst detour.
3. **Reorder + group the nav** (#4, #9) — daily work on top, grouped sections.
4. **Opportunity → proposal generation** (#7) — wire the existing AI quote builder.
5. **Consolidate Finance** (#5) and **terminology pass** (#8).
6. **Automation triggers** (welcome email, invoice, review) as capacity allows.

These are UX/workflow recommendations; the engineering gaps behind some of them
(automation, pagination, DataTable) are tracked in the
[gap tracker](roadmap.md#spec-vs-reality-gap-tracker).
