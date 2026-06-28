# CTO Review — Atlas
**Date:** 2026-06-28 · **Reviewer:** CTO (pre-first enterprise customer)
**Verdict:** Atlas is a well-structured, ambitious product with real engineering
quality — but it is not enterprise-ready today. Several issues would cause visible
failures under real-world load or scrutiny. This report is honest, not diplomatic.

---

## Executive Summary

| Dimension | Grade | One-line verdict |
|---|---|---|
| Architecture | B+ | Solid Next.js 16/Drizzle/Neon foundation; DB connection model wrong for serverless |
| Security | B | Tenant isolation real; no middleware, no CSP, no rate limiting |
| Database | B+ | Good schema; soft delete missing; 11 tables missing `updatedAt` |
| Folder structure | A- | Clean and predictable; minor naming confusion (products = proposals) |
| UI | B | Design system consistent; no loading/error states; mobile overflow |
| UX | C+ | Core flows work; 3 P0 navigation problems; no automation |
| Business logic | B | Core RBAC solid; reference generation has race condition |
| Performance | C+ | Finance page does 4 sequential awaits; DB connection wrong driver |
| Scalability | C | No connection pooler; no caching layer; no queue; single DB point of failure |
| API design | B- | REST-style routes adequate; no versioning; chat endpoint has no body size limit |
| Developer experience | C+ | No CI/CD; one test file; no seed script for fresh dev; two DB drivers in package.json |
| Maintainability | B | `bookings.ts` at 976 lines needs splitting; products/proposals naming confusing |
| Testing | D | One test file in the entire codebase. Not acceptable for enterprise. |
| Deployment | B- | Vercel is fine; no health endpoint; no rollback plan documented |
| CI/CD | F | Zero — no `.github/workflows/`. No automated checks before merge. |
| Documentation | A- | Unusually thorough for this stage; gap tracker is a standout |
| Code quality | B+ | Consistent patterns; 45 raw `console` calls instead of a real logger |

---

## CRITICAL ISSUES
*Must be fixed before the first enterprise customer goes live.*

---

### C1 — No database connection pooler
**File:** `src/lib/db.ts`

```ts
const client = postgres(connectionString); // wrong driver for serverless
```

Atlas uses `postgres` (the `postgres.js` driver) on Vercel serverless functions.
Every function invocation opens a **new TCP connection** to Neon. At 50 concurrent
users that's 50 open connections. At 200 it exhausts Neon's connection limit and
every query starts failing with "too many clients."

Neon provides a **serverless pooler** (`-pooler` suffix in the connection string)
that multiplexes thousands of connections through ~10 persistent ones — but you
need to switch to the **`@neondatabase/serverless`** driver to use it correctly
over HTTP (not TCP), which is mandatory for Vercel edge/serverless.

You also have **two DB drivers** (`postgres` + `pg`) in `package.json` with no
clear owner — `pg` is for Drizzle migrations, `postgres` for runtime. This needs
to be explicit and documented.

**Impact:** 200 concurrent users = database down. Enterprise customer demos in
front of their IT team = connection pool exhaustion at the worst moment.

**Fix:**
```bash
npm install @neondatabase/serverless
```
```ts
// src/lib/db.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
const sql = neon(process.env.POSTGRES_URL!);
export const db = drizzle(sql, { schema });
```
Keep `pg` only for `drizzle-kit` migrations (it needs a real TCP connection).

---

### C2 — Zero CI/CD pipeline
**Finding:** No `.github/workflows/` directory. Nothing runs automatically on
`git push`.

This means:
- A broken build can be pushed to `main` and deployed to production instantly
- No automated type checking, linting, or tests before deploy
- The quality gate (`npm run check`) only runs if someone remembers to run it
- No way to enforce code review before merge

**Impact:** The first enterprise customer will eventually hit a regression caused
by an unreviewed push. At that point you have no safety net and no audit trail.

**Fix:** Create `.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm install --legacy-peer-deps
      - run: npm run check       # lint + typecheck
      - run: npm run build:ci    # next build
```
Vercel already deploys on push — CI just adds the gate before it reaches Vercel.

---

### C3 — No test coverage
**Finding:** One test file exists: `.claude/worktrees/*/src/lib/references.test.ts`
— not even in the main source tree. Zero tests for:
- Server actions (RBAC, tenant scoping, business logic)
- API routes (auth, input validation)
- Domain logic (`domain.ts` — roles, capabilities, booking lifecycle rules)
- Utility functions

**Impact:** Any refactor silently breaks business rules. Enterprise customers expect
vendors to have a test suite. Without it, you cannot safely hire additional
engineers (they will introduce bugs you won't catch).

**Fix (prioritized, not everything at once):**
1. Integration tests for the 5 most critical server actions: `createBooking`,
   `advanceBookingStatus`, `acceptProposalByToken`, `createCommissions`, `createAgency`
2. Unit tests for `domain.ts` (RBAC logic is pure functions — trivial to test)
3. Tenant isolation test already exists as a script (`test-tenant-isolation.ts`) —
   promote it to the CI pipeline

---

### C4 — No middleware (rate limiting, security headers enforcement)
**Finding:** No `src/middleware.ts`. This means:
- Login endpoint (`/api/auth/sign-in`) has no rate limiting — brute-forceable
- Public proposal endpoint (`/p/[token]`) has no rate limiting
- Portal magic-link request has no rate limiting — email flooding
- Security headers (set in `next.config.ts`) work but a middleware could short-
  circuit abuse before it hits server functions

CSP (`Content-Security-Policy`) is also absent from `next.config.ts`. Every major
browser security audit flags missing CSP — an enterprise customer's security team
will catch this immediately.

**Impact:** Any motivated attacker can brute-force login, flood the magic-link
email, or scrape tokenized public proposals. An enterprise security review fails.

**Fix:**
```ts
// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
// Use Upstash ratelimit (Redis-backed, works on Vercel Edge)
export function middleware(req: NextRequest) {
  // 1. Rate limit /api/auth and /api/portal/auth/request
  // 2. Add Content-Security-Policy header
  return NextResponse.next();
}
export const config = { matcher: ["/api/auth/:path*", "/api/portal/:path*"] };
```

---

### C5 — Race condition in booking/proposal reference generation
**File:** `src/lib/actions/bookings.ts:55–68`

```ts
// Fetches ALL booking references for the agency, iterates in JS to find max
const rows = await db.select({ reference: booking.reference })
  .from(booking).where(eq(booking.agencyId, agencyId));
let max = 1000;
for (const r of rows) {
  const n = Number.parseInt(r.reference.replace(/\D/g, ""), 10);
  if (Number.isFinite(n) && n > max) max = n;
}
return `BKG-${max + 1}`;
```

At 10,000 bookings per agency this loads the full reference list into memory on
every creation. Worse: two simultaneous booking creations can read the same max
and produce duplicate references (unique constraint catches it, but the UX is a
silent retry loop, not an atomic increment).

**Impact:** Agencies with high booking volume (enterprise customers) hit slow
booking creation and occasional silent retries. Could silently fail under load.

**Fix:** Atomic SQL max:
```ts
import { max as sqlMax } from "drizzle-orm";
const [row] = await db
  .select({ max: sqlMax(booking.numericReference) })
  .from(booking)
  .where(eq(booking.agencyId, agencyId));
const next = (row?.max ?? 1000) + 1;
return `BKG-${next}`;
```
Requires adding a `numericReference` integer column (same migration as soft delete).

---

## HIGH PRIORITY
*Fix within the first sprint after launch.*

---

### H1 — No soft delete
**File:** `src/lib/schema.ts`

No `deletedAt` column exists anywhere. The "everything is reversible" founding
principle is aspirational only. An agency that accidentally deletes a booking has
no recovery path. This also blocks GDPR erasure (you can't "erase" what you
can't soft-delete and then hard-purge on schedule).

**Fix:** Migration adding `deletedAt: timestamp("deleted_at")` to core tables
(booking, client, opportunity, product), filter all reads with
`.where(isNull(entity.deletedAt))`, and a restore action per entity.

---

### H2 — `requireAgencyUser` makes a DB query on EVERY page render
**File:** `src/lib/permissions.ts:117–132`

```ts
const ag = await db.query.agency.findFirst({
  where: eq(agency.id, user.agencyId),
  columns: { status: true, subscriptionStatus: true },
});
```

This query fires on every authenticated server render. At 1,000 concurrent users
that's 1,000 extra agency-status queries per second. The agency status doesn't
change often — it's a perfect cache candidate.

**Fix:** Cache the agency status in the session token (updated on suspension/
reactivation) or use `unstable_cache` with a short TTL and `revalidateTag` on
suspension events.

---

### H3 — Finance page does 4 sequential DB queries (633 lines)
**File:** `src/app/(app)/finance/page.tsx`

The page is enormous (633 lines) and makes 4+ DB queries, some sequential. It will
be slow as the dataset grows and impossible to maintain.

**Fix:** Split into smaller async components using React Suspense, parallelizing
queries with `Promise.all` or per-section server components. Cap the page at 150
lines of layout; extract `<PaymentsSummary>`, `<CommissionsSummary>`, etc.

---

### H4 — No structured logging (45 raw `console.*` calls in actions)
**Finding:** 45 `console.log/error/warn` calls scattered across action files.
On Vercel these show up as unstructured text in Function Logs with no correlation
IDs, no severity levels, no timestamps, no request tracing.

**Impact:** When an enterprise customer files a support ticket saying "booking
creation failed at 14:32 UTC," you cannot find the relevant log entry.

**Fix:** A one-file logger:
```ts
// src/lib/logger.ts
export const logger = {
  info: (msg: string, meta?: object) =>
    console.log(JSON.stringify({ level: "info", msg, ...meta, ts: new Date().toISOString() })),
  error: (msg: string, meta?: object) =>
    console.error(JSON.stringify({ level: "error", msg, ...meta, ts: new Date().toISOString() })),
};
```
Replace all `console.*` calls. Ship a correlation ID from the request context.

---

### H5 — `bookings.ts` is 976 lines — unmaintainable
**File:** `src/lib/actions/bookings.ts`

Nearly 1,000 lines covering booking CRUD, lifecycle advancement, traveller
management, item management, itinerary, and commission generation. A new engineer
cannot reason about it. Every bug fix risks breaking something else in the file.

**Fix:** Split into:
- `bookings/crud.ts` — create, update, delete
- `bookings/lifecycle.ts` — advance status, prerequisites
- `bookings/travellers.ts` — passenger CRUD
- `bookings/items.ts` — trip service items
- `bookings/commissions.ts` — commission generation

---

### H6 — No health check endpoint
**Finding:** No `/api/health` route. Vercel's uptime monitors, load balancers, and
the enterprise customer's infrastructure team expect one.

**Fix:**
```ts
// src/app/api/health/route.ts
export async function GET() {
  return Response.json({ status: "ok", ts: new Date().toISOString() });
}
```

---

### H7 — Products are called "proposals" everywhere but the URL and the DB
**Finding:** The concept is **Proposal** in all UI, docs, and conversation. But the
database table is `product`, the URL is `/products`, the actions file is
`products.ts`, the type is `ProductInput`. An enterprise customer's developer
integrating via the API will be confused, and new engineers will be too.

**Fix:** Rename — DB table to `proposal`, route to `/proposals`, action file to
`proposals.ts`. One migration, one find-replace. Do it now before the codebase
gets larger.

---

### H8 — No input validation on chat endpoint (body size / message length)
**File:** `src/app/api/chat/route.ts`

No body size limit, no message length cap, no token budget per request. A user
(or attacker) can send a 100KB message that gets passed to the LLM, costing
significant API spend.

**Fix:** Add `export const maxDuration = 30` (Vercel), validate message array
length and individual message size before calling the LLM, and add the rate
limiter from C4.

---

## MEDIUM PRIORITY
*Address in the first 60 days.*

---

### M1 — 11 tables missing `updatedAt`
11 of 24 tables have no `updatedAt` — impossible to answer "when was this record
last changed?" for audit, support, or sync scenarios.

### M2 — No caching layer whatsoever
Dashboard, finance, analytics — every render hits the DB fresh. `unstable_cache`
with `revalidateTag` on mutations would cut DB load by ~60% for read-heavy pages.

### M3 — Opportunities page not in navigation
The core sales pipeline (`/opportunities`) is not in the sidebar — agents can only
reach it via the operations board or a client page. Discovered in the owner UX audit.

### M4 — "Operations" label wrong
`/operations` is the pipeline kanban — "Operations" implies fulfillment/logistics.
Enterprise buyers will be confused during demos.

### M5 — No background jobs / queue
Sending emails, generating PDFs, syncing hotel content, processing webhooks — all
done synchronously in request handlers. Slow operations block the user. Vercel
serverless has a 10s default timeout.

### M6 — Amadeus marked as "legacy" but still in the active provider selection
`getFlightSupplier()` still falls back to Amadeus. The codebase comment says
"decommissioned 2026-07-17". Remove it before it becomes a dead code maintenance burden.

### M7 — No pagination on any list page
All list queries use hardcoded `LIMIT 200` or `LIMIT 500`. An agency with 5,000
clients or 10,000 bookings silently gets a truncated list with no indication that
data is missing. This is a data integrity perception problem for enterprise.

### M8 — Portal session expiry not enforced on the server
The portal session expiry check (`gt(portalSession.expiresAt, new Date())`) exists
but the TTL is not clearly documented and there's no cleanup job to remove expired
sessions. Old sessions accumulate forever.

### M9 — No GDPR compliance path
No data export per client, no erasure flow, no data retention policy, no consent
tracking. EU travel agencies (your primary market) are legally required to provide
these. Blocked by missing soft delete (H1).

### M10 — Two PostgreSQL drivers in package.json
`postgres` (runtime) and `pg` (drizzle-kit migrations) coexist with no
explanation. Confusing for new engineers and a potential version conflict risk.

---

## NICE-TO-HAVE
*Post-stabilization improvements.*

---

### N1 — No PR template or contribution guidelines
No `PULL_REQUEST_TEMPLATE.md`, no `CONTRIBUTING.md`. Enterprise customers who want
to contribute integrations or customizations have no guidance.

### N2 — `picsum.photos` in production image whitelist
`next.config.ts` whitelists `picsum.photos` (lorem ipsum placeholder images) in
production. This is a dev-only domain — remove it from production config.

### N3 — `OPENROUTER_MODEL` defaults to `openai/gpt-5-mini`
The env default in `env.ts` references `gpt-5-mini` — a model that may not exist
or may be deprecated. This should be an explicit, versioned model ID.

### N4 — No API versioning
All API routes are unversioned (`/api/chat`, `/api/export`). When you change the
chat protocol or export format, existing integrations break with no migration path.
Add `/api/v1/` prefixing now while there are no external consumers.

### N5 — Finance page at 633 lines is both a performance and maintainability problem
Covered in H3 — also a nice-to-have style cleanup even after the Suspense split.

### N6 — No Storybook or component documentation
UI components have no visual documentation. When a designer or new frontend
engineer joins, they have no way to browse the component library.

### N7 — `PROTECTED_DB_HOSTS` is a soft guard
The protection against running destructive scripts against prod is a hostname
string comparison. It can be bypassed. Not critical today, but consider a proper
DB IAM role with no DROP/TRUNCATE in production.

---

## What is genuinely good

I want to be clear: most codebases I review at this stage are far messier.
These are the things that show real engineering judgment:

- **Tenant isolation** is correctly implemented and tested — `agencyId` on every
  table, enforced in every query, with a script that verifies no leaks.
- **`ActionResult<T>`** is a clean, consistent error-handling contract.
- **Zod validation** exists and is used, even if not universal.
- **The domain model** (`domain.ts`) is well-organized — roles, capabilities,
  enums, status metadata in one place.
- **The provider abstraction** (`src/lib/suppliers/`) is well-designed — the new
  `providers/` layer with capability-segmented interfaces is production-quality.
- **Security headers** in `next.config.ts` (X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy) — most startups forget these.
- **The documentation** is the best I have seen at this stage. The gap tracker,
  the owner UX audit, the architecture decisions — this saves weeks of onboarding.
- **`env.ts`** validates all environment variables at startup with Zod — catches
  misconfigured deploys immediately.

---

## Priority matrix

| Priority | Issue | Effort | Risk if ignored |
|---|---|---|---|
| **Critical** | C1: No connection pooler | 1 day | DB down at 200 users |
| **Critical** | C2: No CI/CD | 1 day | Broken builds reach prod |
| **Critical** | C3: No tests | 2 weeks | Regressions on every change |
| **Critical** | C4: No middleware/rate limiting | 2 days | Brute force, abuse, CSP fail |
| **Critical** | C5: Reference race condition | 2 hours | Duplicate refs under load |
| **High** | H1: No soft delete | 3 days | Unrecoverable deletes, GDPR block |
| **High** | H2: Agency query on every render | 4 hours | Slow at scale |
| **High** | H3: Finance page 633 lines | 2 days | Slow, unmaintainable |
| **High** | H4: No structured logging | 4 hours | Blind in production |
| **High** | H5: bookings.ts 976 lines | 2 days | Bugs, slow PRs |
| **High** | H6: No health endpoint | 30 min | Monitoring blind |
| **High** | H7: products = proposals naming | 1 day | Developer confusion forever |
| **High** | H8: Chat no input limit | 2 hours | LLM cost abuse |
| **Medium** | M1–M10 | Various | Quality and compliance debt |

---

## Recommended 30-day plan before enterprise onboarding

**Week 1 — Non-negotiable hardening**
- C1: Switch to `@neondatabase/serverless` driver
- C2: Add GitHub Actions CI (lint + typecheck + build)
- C4: Create `middleware.ts` with rate limiting + CSP header
- C5: Fix reference generation with atomic SQL max
- H6: Add `/api/health` endpoint

**Week 2 — Reliability**
- H1: Soft delete migration for core tables
- H4: Replace `console.*` with structured logger
- H8: Chat endpoint body size + rate limit
- H2: Cache agency status

**Week 3 — Code health**
- H5: Split `bookings.ts` into 5 files
- H7: Rename products→proposals (DB + routes + components)
- M3/M4: Fix navigation (add Opportunities, rename Operations)
- C3: Start: integration tests for 5 critical actions

**Week 4 — Enterprise readiness**
- M9: Skeleton GDPR data export per client
- M5: Evaluate Vercel background tasks or QStash for async work
- H3: Split finance page with Suspense
- C3: Continue test coverage

This plan gets Atlas from "impressive prototype" to "defensible enterprise product"
in 30 days. The bones are good. The hardening is what separates a product people
trust with their revenue from one they pilot and abandon.
