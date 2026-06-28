# Decision 0003 — Sprint 1 Booking Architecture

**Date:** 2026-06-28
**Status:** accepted
**Deciders:** engineering (Atlas Sprint 1)

## Context

Atlas had functional search (Duffel flights, Hotelbeds hotels) but no complete
booking workflow. Supplier references were stored as untyped JSONB. There was
no price revalidation, no idempotency, no analytics event stream, and no clear
environment separation between development, sandbox, and production. The
`BookingProvider` interface existed in `providers/types.ts` but nothing used it.

The goal: build the full booking architecture in sandbox so that production
credentials can be plugged in with configuration changes only — no code changes.

## Decision

Build a layered booking architecture: **config → registry → provider adapters →
booking services → server actions → UI**. Each layer is independent and
testable. The UI never sees supplier types. Environment is resolved once in a
config module.

## Reasoning

### Why consolidate to the new `BookingProvider` interface now

The legacy `SupplierProvider` (search-only, both verticals in one class) was a
stepping stone. The new interface is capability-segmented and multi-step
(search → quote → book → cancel). Building Sprint 1 on top of the new interface
means provider adapters written now are the same ones production uses — no
"sandwich migration" later.

### Why four new database tables

`booking_supplier_ref` — supplier references must be queryable (status polling,
cancellation, reporting). Storing them in JSONB is schema-less and unindexable.

`booking_event` — `activity_log` is too coarse for a booking funnel. A dedicated
append-only event table serves as both the compliance audit trail and the
analytics source without a third-party SDK dependency. One write, two consumers.

`booking_document` — vouchers and e-tickets are not line items. Separating them
into their own table allows typed retrieval and future Vercel Blob integration.

`booking_idempotency` — without key tracking, a browser retry or a server-action
re-execution after a timeout can create duplicate supplier orders. The key is
derived deterministically so it is stable across retries for the same booking
attempt.

### Why a single config module (`suppliers/config.ts`)

Scattered `isDuffelConfigured()` / `process.env.*` checks across multiple files
make it impossible to reason about which provider is active. A single config
module resolves `EnvironmentTier` once and returns typed `FlightProviderConfig` /
`HotelProviderConfig` objects. Providers receive config objects — they never read
`process.env` directly.

### Why in-process retry (no job queue)

Sprint 1 is sandbox-only. Async job queues (pg-boss, BullMQ) add operational
complexity that is not justified until production traffic. The `BookingService`
retry handler is synchronous and typed by error code (retryable errors get
exponential backoff; non-retryable errors surface immediately to the UI).

### Why post-booking stubs (not omitted)

Defining `cancel`, `refreshStatus`, `getVoucher`, `modifyPassengers` as typed
interfaces with `NotImplementedError` now means Sprint 2 only fills in
implementations — the UI is already wired against stable types. Omitting the
interfaces forces Sprint 2 to design and implement simultaneously.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Continue using `SupplierProvider` (legacy) | Would require a second migration when production arrives; two abstraction layers for the same concern |
| Store supplier refs in `booking_item.details` JSONB | Unqueryable, no index, no schema guarantee, impossible to cancel/poll |
| Third-party analytics SDK (PostHog, Segment) | External dependency with no offline fallback; `booking_event` table is queryable and sufficient for Sprint 1 |
| Redis for idempotency keys | Redis is not in the stack; DB table with TTL expiry achieves the same guarantee without a new service |
| Async job queue for retry | Premature for sandbox; adds ops burden before production traffic justifies it |

## Consequences

**Easier:**
- Adding a new provider (TravelgateX, Expedia) requires one new adapter file and
  one `register()` call — no changes to services, actions, or UI.
- Switching sandbox → production is `ATLAS_ENV=production` + production tokens.
- Booking funnel analytics are queryable from day one via `booking_event`.
- Duplicate booking prevention is guaranteed at the DB level (idempotency PK).

**Harder:**
- The `booking_idempotency` table needs a periodic cleanup job (expired rows).
  Acceptable trade-off; a simple cron (`DELETE WHERE expires_at < NOW()`) suffices.
- Post-booking stubs surface `NotImplementedError` in the UI — must be surfaced
  gracefully ("Coming soon") rather than silently swallowed.

## Related

- `src/lib/suppliers/config.ts` — environment config module (new, Sprint 1)
- `src/lib/suppliers/providers/types.ts` — `BookingProvider` interface (existing)
- `src/lib/suppliers/providers/registry.ts` — provider registry (existing, now wired)
- `src/lib/schema.ts` — schema additions (migration 0019)
- `docs/database.md` — updated table and migration entries
- `docs/api-integrations.md` — updated provider status
