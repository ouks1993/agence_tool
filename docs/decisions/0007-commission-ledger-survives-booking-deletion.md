# Decision 0007 — Commission ledger survives booking/item deletion

**Date:** 2026-07-02
**Status:** accepted
**Deciders:** Engineering (Atlas)

## Context

A codebase audit (`docs/full-audit-2026-07-01.md`, punch-list #5) found that
`commission.bookingId` and `commission.bookingItemId` were declared
`onDelete: cascade`. Since Atlas has no soft delete anywhere yet (see
[database.md](../database.md#entity-standard)), a hard delete of a `booking` or
`booking_item` — the "never hard delete" rule is currently aspirational for
these tables — silently destroyed the matching `commission` rows along with it.
Commission rows are earnings history (`supplier_to_agency` and
`agency_to_agent`), frequently already `paid`; losing them on a booking delete
is a financial-record-loss bug, not an acceptable side effect of tidying up a
booking.

## Decision

Change `commission.bookingId` and `commission.bookingItemId` foreign keys from
`onDelete: cascade` to `onDelete: set null` (migration
`drizzle/0021_peaceful_vertigo.sql`). The commission row itself is never
deleted when its booking/item is; the link columns just go `NULL`. The
tenant-scoping `commission.agencyId` FK is unaffected and still cascades with
the agency.

## Reasoning

- A commission row is a financial ledger entry, not a child record of the
  booking in the "belongs to and dies with" sense — it documents money that was
  actually earned/paid, independent of whether the originating booking record
  still exists.
- `set null` preserves the row (amount, status, supplier, agent, rate, basis)
  for reporting and audit while honestly reflecting that its originating
  booking/item is gone — a `NULL` link is queryable and doesn't fabricate a
  reference to a row that no longer exists.
- This is the smallest possible fix: a constraint-only migration, no new table,
  no application-code changes required to keep existing commission reads
  working (all report/finance queries already tolerate a nullable join).
- Proper soft-delete on `booking`/`booking_item` would remove the need for this
  entirely, but that's a larger, separately-tracked gap
  ([roadmap.md](../roadmap.md#spec-vs-reality-gap-tracker)); `set null` is the
  correct interim (and arguably permanent, regardless of soft delete) posture
  for a ledger table specifically.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Leave `cascade` as-is | Confirmed data-loss bug; unacceptable for financial history. |
| `onDelete: restrict` (block the delete) | Would make it impossible to delete a booking that has ever generated a commission — too restrictive for legitimate cleanup/test data, and doesn't match how the rest of the schema handles this pattern (`product` → client/opportunity is already `set null`). |
| Snapshot commission fields onto a separate immutable ledger table | Heavier than needed; the existing `commission` row already carries the durable fields (amount, status, rate, basis) — only the *link* needs to survive, not a full denormalized copy. |
| Implement soft delete on `booking`/`booking_item` first, then this becomes moot | Correct long-term fix but a much bigger, separately-tracked change; `set null` closes the immediate financial-data-loss risk without waiting on it. |

## Consequences

- Deleting a booking or booking item no longer deletes any `commission` rows
  that reference it; those rows keep their amount/status/supplier/agent but
  their `bookingId`/`bookingItemId` become `NULL`.
- Commission reports/exports that join through `bookingId` must already handle
  (or now need to handle) a `NULL` link gracefully — e.g. showing "booking
  deleted" rather than crashing on a missing join.
- New indexes `commission_item_idx` (`bookingItemId`) and `commission_supplier_idx`
  (`supplierId`) were added in the same migration to keep those (now more
  frequently `NULL`-scanned) lookups fast.
- Closes punch-list item #5 from the 2026-07-01 audit.

## Related

- Migration: `drizzle/0021_peaceful_vertigo.sql`.
- Docs: [database.md](../database.md) (commission table row + migration table),
  [domain.md](../domain.md) (supplier aggregate section).
- Audit: `docs/full-audit-2026-07-01.md` punch-list #5.
