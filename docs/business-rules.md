# Business Rules

Domain logic and constraints. Enums and capability helpers are defined in
`src/lib/domain.ts`; server-side enforcement lives in the actions under
`src/lib/actions/`.

## Golden workflow

The canonical end-to-end happy path Atlas is built around. Everything starts from
the client (design principle #2) and ends by feeding the next trip — a loop, not a
line.

```
Lead → Client → Opportunity → Proposal → Customer accepts → Booking →
Supplier reservation → Payment → Ticketing → Travel → Feedback → Repeat client
```

| Step | In Atlas | Notes |
|---|---|---|
| **Lead** | `client` with a `source` (lead-source code) | captured as an early-stage client |
| **Client** | `client` (+ contacts) | the spine; all records hang off it |
| **Opportunity** | `opportunity` (pipeline stage, value, `travel_purpose`) | shown on the Pipeline board |
| **Proposal** | `product` (PDF + e-sign) | shareable `/p/[token]` or in-portal |
| **Customer accepts** | e-sign stamps signer + flips opportunity to **won** | also acceptable in the client portal |
| **Booking** | `booking`, one-click **convert proposal → booking** | lifecycle starts at `draft` |
| **Supplier reservation** | `booking_item` + `supplier` picker | live Duffel/Hotelbeds search; real reservation is an open item ([roadmap.md](roadmap.md)) |
| **Payment** | `payment` (deposit/installments, Stripe Connect) | `confirmed` requires zero balance |
| **Ticketing** | lifecycle `ticketed` | requires trip items; auto-generates commissions |
| **Travel** | lifecycle `completed`; itinerary `/i/[token]` | day-by-day timeline, vouchers/invoices |
| **Feedback** | activity log / notes on the client timeline | closes the loop |
| **Repeat client** | back to **Opportunity** on the same client | retention, not re-acquisition |

This maps onto the [booking lifecycle](#booking-lifecycle) below and the role
landings in [architecture.md](architecture.md#per-role-landing).

## Roles & capabilities

Five roles: **admin, manager, finance, support, agent**. The capability matrix is
in [architecture.md](architecture.md#roles--permissions). Key rules:

- `seesAllData` — all roles except **agent** (agents see only their own records).
- `canManageTeam`, `canManagePayments` — admin/manager.
- `canViewFinance` — admin/manager/finance (gates `/finance`, `/commissions`,
  `/reports`).
- `canViewSupport` — admin/manager/support.
- `canDeleteRecords` — admin/manager.
- `canAssignAdmin` — **only an admin** can assign or change the admin role.

## Onboarding & access

- **Invitation-only signup** — enforced at the auth layer (`user.create.before`
  hook). No invite ⇒ no account. See [security.md](security.md).
- **Agency suspension** — a suspended agency locks out its users via
  `requireAgencyUser`.
- **Lapsed subscription** — gates access via `requireAgencyUser` (14-day trial on
  provision). See [api-integrations.md](api-integrations.md).

## Currency

- Supported: **DZD (default)**, EUR, USD.
- **No FX conversion.** The agency operates in DZD; Atlas never sums across
  currencies. Analytics group **by currency** with a DZD headline. See
  [analytics.md](analytics.md).

## References

- `BKG-…` (bookings) and `PRD-…` (proposals) reference numbers are unique
  **per agency**, not globally.

## Booking lifecycle

States: `draft → awaiting_payment → confirmed → ticketed → completed`. A visual
stepper drives it with an "Advance to [next]" button. **Hard prerequisites are
enforced server-side:**

- `confirmed` requires trip items **and** zero outstanding balance.
- `ticketed` requires trip items.
- Vouchers/invoices are **blocked** when a booking has no trip services.

## Proposals & e-signature

- Server-rendered PDF; shareable via public tokenized `/p/[token]` (no login) and
  in-portal signing.
- E-sign stamps signer name/email/IP/UA and flips the linked opportunity to
  **won**.
- **Convert accepted proposal → booking** in one click. (A `convertedBookingId`
  guard column is a pending open item — see [roadmap.md](roadmap.md).)

## Commissions

- **Two ledgers:** `supplier_to_agency` (agency earns from a supplier per booking
  item) and `agency_to_agent` (agent earns from the agency per booking).
- **Auto-generated** when a booking is confirmed or ticketed; **idempotent**.
- Agent rate from `user.commissionRatePercent`; supplier basis from the supplier
  contract (percent / fixed / net).

## Controlled vocabularies

Seven fields are enum dropdowns (codes stored, labels shown) for clean reporting:
lead source, travel purpose, trip type, gender, title, lost reason, industry.
Country/nationality use canonical ISO 3166-1 values (full name stored) so
spellings never drift; city uses curated autocomplete suggestions.

## Client portal

- Magic-link passwordless sessions scoped to **one client**, separate from staff
  auth (`portal_session`).
- Agents send the invite from a client or booking detail page; the link is
  copyable when email is unconfigured.
- Online "Pay now" appears only when the agency has onboarded Stripe Connect.
- Clients can accept/decline proposals in-portal with the same e-sign audit as the
  public flow.
