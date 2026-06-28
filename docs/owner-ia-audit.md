# Information Architecture Audit
**Role:** Senior UX Architect / Product Designer / IA Expert
**Date:** 2026-06-28
**Scope:** Full navigation — not limited to Search vs Hotels

---

## Verdict first

Your instinct is correct but the diagnosis is incomplete. The problem is not just
Search vs Hotels. It is **a navigation built around implementation modules rather
than user tasks**. An experienced travel agent does not think "I need the Hotels
module." She thinks "I need to price accommodation for this client." The current
navigation makes her guess which of four surfaces to open. That is an IA failure.

But I will not blindly agree. Where the current design is defensible, I will say
so — and I will push back on one assumption you may have.

---

## The full navigation — what it actually is

```
Dashboard
Finance          (canViewFinance)
Commissions      (canViewFinance)
Reports          (canViewFinance)
Support          (canViewSupport)
─────────────────────────────────
Bookings
Operations       ← actually a Bookings kanban board
Clients
Search           ← Flights + Hotels tabs, adds to bookings only
Hotels           ← richer hotel search, adds to bookings OR proposals
Assistant
─────────────────────────────────
Suppliers        (canManageTeam)
Team             (canManageTeam)
Billing          (admin only)
Settings
```

**What is missing from the nav entirely:** Opportunities — a full pipeline board
at `/opportunities`, invisible to agents unless they happen to click through from
a client page.

---

## Module-by-module IA analysis

---

### 1. Search vs Hotels

**User intent:**
- Search intent: "I need to price flights and hotels quickly for a booking I am already building."
- Hotels intent: "I want to browse, compare, and select a hotel to include in a quote or booking."

**Mental model:**
A travel agent thinks by task: *quote*, *book*, *manage*. She does not think by
data source. "Search" and "Hotels" are both inventory-discovery tools. When she
opens the nav, she sees two options for what feels like the same job and must
learn — from trial and error — that one is for bookings only, and one is for
both bookings and proposals. That distinction is a data-model detail, not a user
task. Surfacing it in navigation is an IA error.

**Does this create ambiguity?** Yes, significantly.

**Does it violate "one obvious place"?** Yes. There is no obvious rule a new agent
can apply to decide which to use. "Hotels for proposals, Search for bookings" is
not a rule anyone would invent without reading documentation.

**The real distinction (and where I push back on you):**
The two modules are *functionally* different — Search is quick/booking-centric,
Hotels is rich/proposal-capable. That distinction is real and worth preserving.
The mistake is surfacing the *technical* distinction in the navigation label rather
than the *task* distinction. You do not need to kill one. You need to collapse them
into one coherent "sourcing" experience with appropriate context (booking vs
proposal) at the point of "Add to…". The richer Hotels UX (filters, compare,
gallery) should become the default experience for hotel search everywhere.

**Should they coexist?** Not as separate nav items. They should be one surface:
**Sourcing** (or **Inventory**), with tabs or sub-pages per product type.

**What Salesforce / HubSpot would do:**
A CRM that sells to sales reps never puts "Search Contacts" and "Contacts" as
two separate nav items. There is one "Contacts" section, and search is a behavior
*within* it. The same principle applies here. Sourcing is one section; Flights and
Hotels are product-type tabs within it.

**Scalability:**
This is the strongest argument for consolidation. When Cars, Cruises, Packages,
and Insurance are added, a flat nav becomes:

```
Search   Hotels   Cars   Cruises   Insurance   Packages   (+ Visa?)
```

That is seven sourcing nav items alongside five CRM items alongside four finance
items. The nav breaks completely. A grouped "Sourcing" section with sub-items
scales to any number of product types without nav collapse.

---

### 2. Bookings vs Operations (the clearest IA error in the codebase)

**What they are:**
`/bookings` = a booking list (table view, filterable, switchable to board)
`/operations` = a booking kanban board (same data, board view only)

These are the **same page with different display modes**. The board toggle already
exists on `/bookings`. `Operations` is redundant — it is a second nav item for a
view mode that already exists as a button.

**User intent:** "I want to see my active bookings." Whether she wants a list or a
board is a display preference, not a different destination.

**IA verdict:** Operations should be deleted as a nav item. The board view
belongs on Bookings as a toggle (it already is — the nav item is the duplicate).

---

### 3. Opportunities — the ghost page

**What it is:** A full pipeline board at `/opportunities` with stats, a kanban by
deal stage, and conversion funnel analytics.

**What it is in the nav:** Nothing. It does not appear.

**User intent:** "Where are my leads and open deals?" An agent managing her
pipeline has no nav item to find it. She discovers it only if she navigates to
a client and clicks through, or knows the URL.

**IA verdict:** This is not a cosmetic issue. For a product whose golden workflow
starts with Lead → Opportunity → Proposal → Booking, making the second step
invisible from the navigation is a structural gap. It must be surfaced.

---

### 4. Finance / Commissions / Reports (three items for one mental model)

**User intent:** "How is the agency doing financially?"

**Mental model:** A manager opens the nav thinking "money." She sees Finance,
Commissions, and Reports — three items — and must learn what lives where:
- Finance: payment tracking and AR
- Commissions: who earned what
- Reports: data export

These are not three separate concepts to a manager. They are three views of the
same question. Salesforce puts Revenue, Pipeline, and Forecasting under one
"Reports & Dashboards" section. HubSpot puts Sales, Deals, and Forecasting under
one "Sales" hub. Three flat nav items for finance creates scanning overhead on
every visit.

**IA verdict:** Group under one **Finance** section with sub-pages. The nav item
is one; the destination has internal tabs.

---

### 5. The Assistant

**Current position:** Between Hotels and Suppliers — the middle of the nav.

**What it is:** An AI chat with agency-scoped tools (find clients, search
flights/hotels, create bookings). It is a power-user productivity feature.

**IA concern:** Placing a chat interface between Hotels and Suppliers implies it
is a primary workflow destination. It is not — it is a tool overlay. Most mature
products (Intercom, Notion, Linear) surface their AI assistant as a persistent
widget or keyboard shortcut (`Cmd+K`), not a nav destination. Making it a nav
item elevates it above more important modules.

**IA verdict:** Consider moving Assistant to a persistent floating button or
keyboard shortcut. If it stays as a nav item, it belongs at the bottom near
Settings — not in the middle of the workflow items.

---

### 6. Nav order vs the golden workflow

The current nav order:
```
Finance → Commissions → Reports → Support → Bookings → Operations → Clients → Search → Hotels
```

The golden workflow:
```
Client → Opportunity → Proposal → Booking → Supplier → Invoice → Payment
```

The nav is almost exactly backwards. Finance (the end of the funnel) appears
before Clients (the beginning). Bookings appears before Clients. Opportunities
does not appear at all. An agent who follows the natural workflow has to scroll
past everything she does not need daily to reach what she does.

---

### 7. Cognitive load: 15 flat items

Miller's Law: working memory holds 7±2 items. The current nav has 15 items
(varying by role). Even at the minimum (agent role), it has 10+ items with no
visual grouping. Every visit requires scanning the full list. A grouped nav with
4–5 sections of 3–4 items each is far faster to scan because the user learns
section locations, not item positions.

---

## Recommended navigation tree

```
▸ WORK
    Dashboard
    Clients          (CRM anchor — golden workflow starts here)
    Pipeline         (was: Opportunities — pipeline board)
    Proposals        (was: Products — quote builder)
    Bookings         (list + board toggle; absorbs Operations)

▸ SOURCING           (new section — absorbs Search + Hotels)
    Flights
    Hotels
    [Cars]           (add when ready)
    [Cruises]        (add when ready)
    [Packages]       (add when ready)

▸ FINANCE            (canViewFinance — grouped)
    Overview         (was: Finance page)
    Commissions
    Reports & Export (was: Reports)

▸ TOOLS
    AI Assistant     (demoted from primary nav; or keyboard shortcut)

▸ ADMIN              (canManageTeam / admin)
    Suppliers
    Team
    Billing          (admin only)

▸ ACCOUNT (bottom, always)
    Settings
    Profile
```

**Support** stays accessible but moves to where support-role users land (their
dedicated `/support` page as the home), not as a permanent nav item visible to
agents who never use it.

---

## Reasoning for every change

| Change | Reason |
|---|---|
| Search + Hotels → Sourcing section | Eliminates the core ambiguity. Both are inventory-discovery. Section scales to Cars/Cruises/Packages without nav collapse. |
| Operations deleted | It is the Bookings board view, which already exists as a toggle on /bookings. Two nav items for one concept. |
| Opportunities → Pipeline (surfaced) | The P0 navigation gap. The entire sales funnel's second step was invisible. |
| Products → Proposals (renamed) | Product is a code-level name. Proposal is what agents call it, what clients sign, and what every competitor calls it. |
| Finance grouping | Three flat items for one mental model. One section header with sub-navigation. |
| Nav order follows golden workflow | Clients before Finance. WORK section before FINANCE section. Nav reads like a workflow, not a sitemap. |
| Assistant demoted | AI chat is a tool, not a destination. Moving it to a persistent shortcut or the bottom frees prime nav space for workflow items. |
| Admin section | Separates infrequently-used management items from daily workflow items. Role-gated items are visually grouped. |

---

## Where the current design is actually defensible

I want to be honest here. Two things in the current navigation are correct:

1. **The inline booking search panel is right.** Searching for flights and hotels
   from within a booking is the most contextual, lowest-friction path — the agent
   stays in her booking file. This should stay and become the *primary* way agents
   source inventory for confirmed trips.

2. **The separation of billing and settings is right.** Billing (Stripe
   subscriptions) is admin-only and operationally distinct from Settings
   (preferences, language). They should not be merged even though both feel like
   "admin stuff."

---

## Migration strategy

**Phase 1 — Zero code, highest impact (1 sprint)**
- Add "Pipeline" to the nav linking to `/opportunities`
- Rename "Operations" to "Board" or remove it (board toggle already on /bookings)
- Reorder nav items to follow the golden workflow (Clients, Pipeline, Proposals,
  Bookings — in that order)

**Phase 2 — Rename (1 sprint)**
- Rename `/products` route to `/proposals`, update all links and metadata
- Rename "Products" to "Proposals" everywhere in the UI
- Keep `/products` as a redirect for any bookmarks

**Phase 3 — Sourcing section (1–2 sprints)**
- Create a grouped nav section "Sourcing" with Flights and Hotels as sub-items
- `/sourcing/flights` replaces `/search` (Flights tab)
- `/sourcing/hotels` absorbs `/hotels` and `/search` (Hotels tab)
- Unify the experience: use the richer Hotels UX (filters, compare, gallery) as
  the standard for all hotel searches, including from within a booking
- Remove the duplicated `booking-search-panel.tsx` logic (currently verbatim copy
  of `search-workspace.tsx`)
- Keep `/search` and `/hotels` as redirects for 90 days

**Phase 4 — Finance grouping (1 sprint)**
- Group Finance, Commissions, Reports under one nav section with an internal tab
  or sub-page structure

**Phase 5 — Assistant repositioning (optional)**
- Move the AI chat to a persistent `Cmd+K` or floating button
- Keep the nav item if analytics show it drives daily use

---

## Decision to record

This IA change should be recorded at `docs/decisions/0001-sourcing-ia.md` once
the direction is confirmed, covering: the consolidation of Search + Hotels into
Sourcing, the renaming of Products → Proposals, and the surfacing of Opportunities
in the nav.
