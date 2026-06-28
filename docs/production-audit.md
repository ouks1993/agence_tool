# Production-Readiness Audit

**Date:** 2026-06-28 · **Auditor:** Lead Software Architect · **Scope:** security,
error handling, performance, code quality, UX, database. No new features.

> **Note:** the brief mentioned "optimize Prisma" — Atlas uses **Drizzle ORM**, not
> Prisma. Drizzle findings are reported instead.

## Summary

Atlas has **strong security foundations** — tenant isolation, authorization, and
input safety are largely correct. The gaps are in **operational hardening**
(rate limiting, error handling, loading states) and **reversibility** (no soft
delete). One genuine horizontal-privilege-escalation issue was found **and fixed**
during this audit.

| Area | Verdict |
|---|---|
| Security | 🟢 Solid; 1 escalation bug fixed, 2 hardening gaps |
| Error handling | 🟡 Inconsistent try/catch; few error boundaries |
| Performance | 🟢 Well-indexed; pagination missing |
| Code quality | 🟢 Clean; minor lint/dup |
| UX | 🟡 Loading/error/mobile gaps |
| Database | 🟢 Good FKs/indexes; no soft delete |

---

## 1. Security

| # | Issue | Severity | Proposed fix | Status |
|---|---|---|---|---|
| S1 | **Horizontal privilege escalation** — detail pages (`bookings/clients/opportunities/products/[id]`) were tenant-scoped (`agencyId`) but **not** agent-scoped, so an agent could open a colleague's record by direct URL. | **High** | Add agent own-scope (`createdById`/`ownerId`/`assignedToId`) to each detail query, gated by `seesAllData(role)`. | ✅ **Fixed** (4 files this audit; list pages fixed earlier in `134ceb3`) |
| S2 | **No rate limiting** on login, the public proposal token endpoints (`/p/[token]`, `acceptProposalByToken`), or API routes — brute-force / abuse vector. | **Medium** | Add an IP+route limiter (e.g. Upstash ratelimit) in middleware for auth + public token routes. | ⬜ Recommended |
| S3 | **Demo credentials committed** in `docs/deployment.md` (incl. platform-admin). | **Medium** | Rotate the demo passwords; move them out of the repo or behind a private note. | ⬜ Recommended |
| S4 | Supplier-detail booking-item count query not explicitly agency-scoped (logically safe via FK ownership). | **Low** | Add `agencyId` to the count `where` for defense-in-depth. | ⬜ Optional |

**Verified GOOD (no action):**
- **Tenant isolation** — `requireAgencyUser()` on every `(app)` page (enforced in the layout) and every server action; `getSupplierById`, all `[id]` detail queries, and exports filter by `agencyId`. `scripts/test-tenant-isolation.ts` exists.
- **Authorization** — all 20 action files guard their exports (`billing` via a `requireBillingAdmin` wrapper; `platform` via `requirePlatformAdmin`; `platform.exitAgencyView` only clears cookies; `proposals-public` is token-authorized by design).
- **No SQL injection** — Drizzle parameterizes; no `sql.raw`/string-built queries.
- **No XSS sinks** — zero `dangerouslySetInnerHTML`; React auto-escapes.
- **Secrets** — `.env*` gitignored; no `.env` tracked; Stripe webhooks verify signatures.

## 2. Error Handling

| # | Issue | Severity | Proposed fix |
|---|---|---|---|
| E1 | Only **10/20** action files use `try/catch`; uncaught throws surface a generic Next error. | **Medium** | Standardize on the `ActionResult` return shape with user-friendly messages; wrap external calls (Stripe/Duffel/Hotelbeds/Resend) in try/catch. |
| E2 | Only `assistant/` has an `error.tsx`; most routes have no error boundary. | **Medium** | Add `error.tsx` per route group (or one in `(app)/`) with a retry action. |
| E3 | No structured logging; `logActivity` covers ~11/21 action files. | **Low** | Add a logger; extend `logActivity` to every mutation. |

## 3. Performance

| # | Issue | Severity | Proposed fix |
|---|---|---|---|
| P1 | Hardcoded `limit` (200/500) on list queries — **silent truncation** and unbounded scan as data grows. | **Medium** | Real pagination (cursor/offset) — pairs with the planned `DataTable`. |
| P2 | No obvious N+1 — queries use `with` joins and grouped counts. | — | None. |
| P3 | Mostly Server Components (good); bundle not analyzed; no `next/dynamic` for heavy client islands (charts, search sheet). | **Low** | Run `@next/bundle-analyzer`; lazy-load chart/search client components. |

DB is well-indexed (**53 indexes**) and Drizzle is parameterized — no slow-query
red flags in static review (runtime profiling recommended).

## 4. Code Quality

| # | Issue | Severity | Proposed fix |
|---|---|---|---|
| Q1 | Redundant auth: `suppliers/[id]` calls `requireAgencyUser()` then `getSupplierById` calls it again. | **Low** | Drop the page-level call (helper already guards). |
| Q2 | 47 ESLint `import/order` warnings. | **Low** | `pnpm lint --fix` (auto-fixable). |
| Q3 | No dead code or duplicated logic found; `src/lib` (domain/queries/analytics) and domain-foldered components are clean. | — | None. |

## 5. UX

| # | Issue | Severity | Proposed fix |
|---|---|---|---|
| U1 | Loading states missing on most routes (only `assistant`/`dashboard`). | **Medium** | Add `loading.tsx` per route using the existing `skeleton.tsx`. |
| U2 | Error states missing (see E2). | **Medium** | Add `error.tsx`. |
| U3 | Tables overflow on mobile (no `overflow-x-auto`). | **Medium** | Wrap tables; ship the responsive `DataTable`. |
| U4 | Accessibility not deeply audited. | **Low** | Run the web-interface-guidelines pass (focus order, labels, contrast). |
| U5 | Empty states are present and filter-aware. | — | None (good). |

## 6. Database

| # | Issue | Severity | Proposed fix |
|---|---|---|---|
| D1 | **No soft delete** (`deletedAt`) anywhere; FK cascades perform **hard** deletes — conflicts with the "everything is reversible" principle. | **Medium** | Add nullable `deletedAt` to core tables + filter reads (needs migration). |
| D2 | `reference` only on `booking`/`product`; `updatedAt`/`status`/`notes` inconsistent on child tables. | **Low** | Backfill per the [entity standard](database.md#entity-standard) (needs migration). |
| D3 | FKs (45 `onDelete`: 25 cascade / 20 set null), indexes (53), sequential migrations (latest `0017`), `generate→migrate` workflow. | — | **Verified good.** |

## 7. Files modified (this audit)

- `src/app/(app)/bookings/[id]/page.tsx` — agent own-scope on detail query
- `src/app/(app)/clients/[id]/page.tsx` — agent own-scope on detail query
- `src/app/(app)/opportunities/[id]/page.tsx` — agent own-scope on detail query
- `src/app/(app)/products/[id]/page.tsx` — agent own-scope on detail query

(Earlier this session: list-page agent scoping `134ceb3`; quality-gate repair `7d5f4e1`.)
Verified: `npm run check` (lint + `tsc`) passes clean.

## Remaining recommendations (priority order)

1. **Rate limiting** (S2) — highest-value security add; small, middleware-level.
2. **Soft delete migration** (D1) — unblocks reversibility *and* GDPR erasure.
3. **Error boundaries + loading states** (E2/U1/U2) — mechanical, big UX win; `skeleton.tsx` already exists.
4. **Real pagination** (P1) — fold into the shared `DataTable` build.
5. **Rotate committed demo credentials** (S3).
6. **Standardize action error handling** (E1) on the `ActionResult` shape.
7. **Lint --fix + bundle analysis** (Q2/P3).

All items are tracked in the
[spec-vs-reality gap tracker](roadmap.md#spec-vs-reality-gap-tracker).
