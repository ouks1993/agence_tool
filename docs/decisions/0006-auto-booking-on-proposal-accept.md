# Decision 0006 — Auto-create a booking when a client accepts a proposal

**Date:** 2026-07-01
**Status:** accepted
**Deciders:** Engineering (Atlas)

## Context

Accepting + e-signing a proposal is the client's commitment moment, yet the
booking was created only when an agent later clicked "Convert to booking".
That leaves a gap between the client committing and Atlas having a booking file
to collect payment against — slower time-to-booking and a manual step that can be
forgotten.

The acceptance happens in the **client context** — the authenticated client
portal (`acceptProposalFromPortal`) and the unauthenticated public token link
(`acceptProposalByToken`). Neither has an agent session, so the conversion
cannot use `requireAgencyUser()`. Three hard constraints:

1. **Tenant safety** — the public path is a tenant boundary; a client action must
   never be trusted to supply an `agencyId`.
2. **Idempotency** — a proposal must never spawn two bookings across re-accepts,
   double-submits, and the manual convert button.
3. **Best-effort** — a booking error must never make the client's acceptance fail.

## Decision

Extract a shared, auth-agnostic `createBookingFromAcceptedProposal(productId, {
actorUserId })` helper in `src/lib/actions/bookings.ts` that both accept actions
call (best-effort, in try/catch) right after marking the proposal accepted, and
that the agent `convertProposalToBooking` delegates to. A new nullable
`product.convertedBookingId` FK latches the created booking and enforces
idempotency.

## Reasoning

- The helper derives its tenant scope from the loaded `product.agencyId` — the
  only trusted source on the public path — and inserts the booking + items under
  that agency, satisfying tenant safety without `requireAgencyUser`.
- `convertedBookingId` is a single-column, additive guard: the helper returns the
  existing booking id as a no-op when it is set, and the linking `UPDATE` is
  guarded on the column still being NULL, so concurrent/duplicate calls converge
  on one booking.
- Wrapping the call in try/catch on the client path keeps acceptance resilient:
  the client always succeeds; the agent can convert manually if the auto-booking
  throws.
- Reusing the same helper for the agent path removes duplicated conversion logic
  and makes the manual convert button idempotent for free.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Keep manual-only conversion | Leaves the time-to-booking gap the Feature Filter rule targets. |
| Reuse `createBooking` + `addBookingItem` (which call `requireAgencyUser`) | Impossible on the public path — no agent session; would break tenant derivation. |
| A separate `proposal_conversion` idempotency table | Heavier than needed; a single nullable FK on `product` is the natural latch and doubles as a queryable link. |
| Make acceptance fail if booking creation errors | Violates the best-effort rule — a client must never be blocked by an internal booking error. |
| New booking status `draft` | The client has committed, so `awaiting_payment` is the correct lifecycle entry. |

## Consequences

- Accepting a proposal (portal or public link) now yields an `awaiting_payment`
  booking automatically, tenant-scoped and idempotent.
- `booking.createdById` is the proposal's owner/creator when known, else null
  (system), since there is no agent actor on the client path.
- The agent convert button is now idempotent (safe to double-click).
- One more thing to keep in sync: the auto-booking carries item pricing at
  `unitPrice`; downstream commission/accounting still runs on booking confirm.

## Related

- Migration: `drizzle/0020_clever_khan.sql` (adds `product.converted_booking_id`).
- Code: `src/lib/actions/bookings.ts` (`createBookingFromAcceptedProposal`,
  refactored `convertProposalToBooking`), `src/lib/actions/portal-proposals.ts`,
  `src/lib/actions/proposals-public.ts`, `src/lib/schema.ts`.
- Docs: `docs/business-rules.md`, `docs/domain.md`.
