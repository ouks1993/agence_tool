# Decision 0008 — One set of booking lifecycle guards, shared by both status-change entry points

**Date:** 2026-07-02
**Status:** accepted
**Deciders:** Engineering (Atlas)

## Context

A booking's status can be changed two ways: the lifecycle stepper's "Advance to
[next]" button (`advanceStatus`, which only ever steps to the immediate next
stage) and a status dropdown that can jump directly to any status
(`setBookingStatus`). The 2026-07-01 audit (punch-list #2) found that
`setBookingStatus` enforced **none** of `advanceStatus`'s prerequisites: a
zero-item, fully-unpaid booking could be set straight to `ticketed` or
`completed` from the dropdown, bypassing the items-required and
zero-balance-required rules, and — because the commission auto-generation call
was also only wired into `advanceStatus` — silently skipping commission
generation for bookings that reached `confirmed`/`ticketed` via the dropdown.
Any future third entry point (a bulk-status API, an admin tool) would have
faced the same choice: duplicate the rules again, or drift.

Separately, ticketing a proposal-converted booking crashed (punch-list #1):
auto-created booking items from `createBookingFromAcceptedProposal` have no
`details` (no supplier offer was ever selected for them), and
`serviceBookFlight`/`serviceBookHotel` dereferenced `offer.rawOfferId`/`offer.rateKey`
directly, throwing on a null `offer`. Both entry points call the same ticketing
path, so this needed a single fix, not two.

## Decision

Extract the lifecycle prerequisites into two shared helpers in
`src/lib/actions/bookings.ts` — `checkStatusPrerequisites(existing, target)` and
`runTicketingConfirmation(existing, agencyId, userId)` — and have **both**
`setBookingStatus` and `advanceStatus` call them, in the same order, with the
same commission-generation trigger. `setBookingStatus` becomes exactly as
strict as `advanceStatus`, just able to target any status instead of only the
next one. `serviceBookFlight`/`serviceBookHotel` in `booking-service.ts` gain an
explicit null-offer guard that returns a provisional reference (reason: "No
supplier offer attached to this item") instead of throwing.

## Reasoning

- A single shared helper pair is the only way to guarantee the dropdown and the
  stepper can never drift apart on what's "legal" — there is exactly one place
  that defines "can this booking become `confirmed`/`ticketed`/`completed`
  right now", and every current and future caller goes through it.
- `checkStatusPrerequisites` keys off the **target** status, not the transition
  path, so it naturally covers `setBookingStatus`'s any-status jumps: reaching
  `confirmed` requires items + zero balance regardless of which status the
  booking is jumping *from*.
- `runTicketingConfirmation` already had the right shape (loop items, book via
  the provider registry, abort on any failure) — lifting it out and calling it
  from both places means the "never ticket off a fabricated confirmation" rule
  is enforced identically everywhere, not just on the stepper's path.
- The UI-level fix (narrowing the status dropdown's offered options to legal
  transitions, and dropping the stale `paid` option) is a UX improvement layered
  on top of the real fix — the server-side guard is the actual invariant; the
  dropdown narrowing just avoids agents hitting an error message for an
  obviously-illegal jump.
- The null-offer guard in `booking-service.ts` is the correct place for the fix
  (not a special-case in `bookings.ts`) because "no offer attached" is a
  property of the booking item, and any caller of `serviceBookFlight`/
  `serviceBookHotel` — not just the ticketing flow — needs the same protection.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Duplicate the guard logic into `setBookingStatus` inline | Exactly the drift risk this decision exists to prevent — two copies of "what makes a status legal" will diverge the next time either is touched. |
| Only fix the ticketing crash, leave `setBookingStatus` unguarded | Leaves the more severe bug (punch-list #2, a High-severity guard bypass) in place; the crash and the missing-guards bug share a root cause (the two entry points never shared code) and are naturally fixed together. |
| Remove `setBookingStatus` / the dropdown entirely, keep only `advanceStatus` | Removes a genuinely useful capability (correcting a mis-set status, reopening a cancelled booking) for agents/admins; the fix is to guard it properly, not remove it. |
| Throw on a null offer instead of falling back to a provisional reference | Breaks the existing "never crash, always return a reviewable provisional result" contract `confirmItemBooking`/`ItemBookingResult` already establish for every other failure mode — a missing offer should be handled the same way as a provider outage. |

## Consequences

- `setBookingStatus` and `advanceStatus` can never again enforce different
  rules for the same target status — a change to the prerequisites is a
  one-function edit.
- Ticketing a proposal-converted booking (no supplier offer on its items) now
  completes with provisional references instead of throwing; the agent sees
  the item marked `pending` with a clear reason instead of a crashed request.
- The status dropdown only offers transitions that can actually succeed
  server-side (current + backward + one step forward + cancelled), reducing
  wasted round-trips to a rejected `setBookingStatus` call.
- Closes punch-list items #1 and #2 from the 2026-07-01 audit.

## Related

- Code: `src/lib/actions/bookings.ts` (`checkStatusPrerequisites`,
  `runTicketingConfirmation`, `setBookingStatus`, `advanceStatus`),
  `src/components/bookings/booking-status-control.tsx` (`allowedTransitions`),
  `src/lib/suppliers/booking-service.ts` (`serviceBookFlight`/`serviceBookHotel`
  null-offer guard).
- Docs: [business-rules.md](../business-rules.md#booking-lifecycle).
- Audit: `docs/full-audit-2026-07-01.md` punch-list #1 and #2.
