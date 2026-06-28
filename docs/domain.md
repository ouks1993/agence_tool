# Domain Model

The core business entities and how they relate. This is the **data/relationship**
view; the process view (states, who does what) is the
[golden workflow](business-rules.md#golden-workflow). Tables and columns live in
[database.md](database.md).

## The chain

```
Lead → Client → Opportunity → Proposal → Booking → Supplier →
Invoice → Payment → Accounting → Travel → Feedback
```

The **client is the aggregate root** — everything hangs off it, and every entity
is scoped to an `agencyId` (founding principle #2).

## Entities

| Domain concept | Table(s) | Status | Key relations |
|---|---|---|---|
| **Lead** | `client` (status `lead`, `source` code) | ✅ | becomes a Client; no separate table |
| **Client** | `client` (+ `client_contact`) | ✅ | root; owns opportunities, proposals, bookings |
| **Opportunity** | `opportunity` | ✅ | belongs to a client; `assignedToId`; links to a proposal |
| **Proposal** | `product` (+ `product_item`) | ✅ | belongs to client; e-sign; converts → Booking |
| **Booking** | `booking` (+ `booking_traveller`, `booking_item`, `booking_day`) | ✅ | belongs to client; lifecycle states; items reference suppliers |
| **Supplier** | `supplier` (+ `supplier_contract`, `supplier_rate`) | ✅ | referenced by `booking_item.supplierId` + `product_item` |
| **Invoice** | — (on-demand PDF: `booking-docs/[id]/invoice`) | 🟡 | no managed invoice entity yet (planned module) |
| **Payment** | `payment` (child of booking) | ✅ | deposits/installments; Stripe Connect |
| **Accounting** | `commission` ledger only | 🟡 | partial; no GL/accounting entity (planned module) |
| **Travel** | `booking` (state `completed`) + `booking_day` | ✅ | itinerary timeline; vouchers |
| **Feedback** | — (`activity_log` / notes) | 🔴 | no review/feedback entity (planned module) |

## Aggregates & ownership

- **Client aggregate** — `client` → `client_contact`; the spine that opportunities,
  proposals, and bookings all reference by `clientId`.
- **Booking aggregate** — `booking` → `booking_traveller`, `booking_item`,
  `booking_day`, `payment`. Children carry **no** `agencyId`; they inherit tenancy
  through the parent booking (scoped via the parent on every query).
- **Supplier aggregate** — `supplier` → `supplier_contract` → `supplier_rate`;
  `commission` rows link a booking item back to the earning supplier/agent.
- **Reference data** — `hotel_content` is **global** (not tenant-scoped); ISO
  countries/vocabularies are canonical lookups, not per-agency rows.

## Where the chain is aspirational

Three links are not yet first-class domain entities — they're the bridge to the
[planned modules](roadmap.md#planned-modules):

- **Invoice** — today an on-demand PDF; the Accounting module turns it into a
  numbered, ledgered record.
- **Accounting** — only the two-ledger `commission` exists; no general ledger.
- **Feedback** — not modelled; "Travel completed → request review" is an unbuilt
  [automation trigger](business-rules.md#automation-triggers).

See the [entity standard](database.md#entity-standard) for the baseline fields
every one of these should carry.
