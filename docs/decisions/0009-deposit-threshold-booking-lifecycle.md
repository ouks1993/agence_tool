# Decision 0009 — Deposit-threshold booking confirmation

**Date:** 2026-07-02
**Status:** accepted
**Deciders:** Product owner + Engineering (Atlas)

## Context

The public proposal signing page promised clients "a 50% deposit
(DZD …) secures your dates", while the booking lifecycle required a **zero
outstanding balance** to reach `confirmed`. A client who did exactly what the
proposal asked — paid the deposit — left the booking stuck in
`awaiting_payment`, blocking everything downstream (supplier booking,
ticketing, commissions). The sales promise and the operational rule
contradicted each other at the workflow's money moment. The delayed supplier
booking also amplified rate-expiry risk: bedbank/GDS rates drift between
acceptance and full payment, which is why the provider layer re-quotes before
booking.

## Decision

Make confirmation deposit-based and agency-configurable:

- New column `agency.depositPercent` (`numeric(5,2)`, NOT NULL, default `50`)
  — migration `drizzle/0023_steep_wild_pack.sql`; editable 0–100 in
  Settings → Agency (admin/manager).
- `confirmed` now requires `paid ≥ depositPercent % of the booking total`
  (pure helper `src/lib/payments/deposit.ts`, cent-rounded so float noise
  can't block a threshold-exact payment).
- The **zero-balance gate moves to `ticketed`** (and remains on `completed`):
  full payment is due before supplier orders are issued, not before
  confirmation.
- The deposit sentence on client-facing proposals (public token page, portal
  signing view, builder preview) is sourced from the **same column**, so the
  promise and the gate can never diverge again. A 0% deposit hides the deposit
  clause ("full payment due at booking").

## Reasoning

- Real agencies confirm on deposit and settle before ticketing; requiring full
  payment to confirm blocked the workflow at the client's moment of highest
  commitment (fails the "reduces time to booking" feature filter in reverse).
- 100% collapses exactly to the previous behavior, so conservative agencies
  lose nothing; 0% supports invoice-later corporate relationships.
- One source of truth for the percentage (principle #3, no duplicated data):
  proposal copy, lifecycle guard, and settings all read `agency.depositPercent`.

## Consequences

- `autoGenerateCommissions` still fires on entering `confirmed`/`ticketed`
  (unchanged) — commissions can now be generated with a balance outstanding,
  which matches the earned-not-yet-settled semantics of the ledger's `pending`
  status.
- The booking-detail UI (advance button + status dropdown) shows a deposit
  soft-warning for `confirmed` and balance warnings only for `ticketed`+
  (server-side guards remain the source of truth).
- Unit coverage: `src/lib/payments/deposit.test.ts` (18 cases — thresholds,
  clamping, rounding, float noise).
