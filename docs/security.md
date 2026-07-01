# Security

## Security controls

The control areas Atlas is held to, with honest current status
(✅ in place · 🟡 partial / provider-level · 🔴 not implemented). Details for the
implemented ones follow in the sections below.

| Control | Status | Notes |
|---|---|---|
| **Tenant isolation** | ✅ | `agencyId` scoping via `requireAgencyUser()`; verified by `scripts/test-tenant-isolation.ts`. |
| **RBAC** | ✅ | 5 roles + capability helpers in `src/lib/domain.ts`; agent visibility scoped on list pages too. |
| **Webhook verification** | ✅ | Stripe billing + Connect webhooks verify the `Stripe-Signature` HMAC (with replay-window + constant-time compare) before acting. |
| **Audit logs** | 🟡 | `activity_log` + `logActivity` used in ~11 action files; not yet universal. |
| **Encryption** | 🟡 | TLS in transit + Neon at-rest (provider); Better Auth hashes passwords. No app-level field encryption. |
| **Password policy** | 🟡 | Better Auth defaults only; no enforced strength/rotation policy. |
| **Secrets management** | 🟡 | Vercel env vars; **demo credentials committed in the repo** (rotate before prod). No vault. |
| **Backups** | 🟡 | Neon automatic backups + branching (provider-level); not app-managed or restore-tested. |
| **Rate limiting** | 🔴 | None on auth, portal magic-link, or API routes. |
| **GDPR** | 🔴 | No subject data-export/erasure flow or consent tracking; right-to-erasure also blocked by missing soft delete. |
| **Disaster recovery** | 🔴 | No documented DR runbook or RTO/RPO targets. |

> The 🔴/🟡 rows are tracked in the
> [spec-vs-reality gap tracker](roadmap.md#spec-vs-reality-gap-tracker).

## Tenant isolation

Every business table carries `agencyId` (root) or inherits it via a parent
(children). **All** reads/writes are scoped by agency through
`requireAgencyUser()` → `user.agencyId`. Reference numbers (`BKG-…`, `PRD-…`) are
unique per agency, not globally. See [architecture.md](architecture.md#multi-tenancy).

### How scoping is enforced

There is **no `middleware.ts`** performing tenant routing — isolation is enforced
in-code at the top of every protected Server Component, layout, and Server Action:

1. The page/action calls `requireAgencyUser()` (`src/lib/permissions.ts`), which
   returns an `AgencyUser` whose `agencyId` is guaranteed non-null.
2. Every subsequent Drizzle query filters on that `agencyId`. Root tables filter
   directly; child rows use a **double constraint** (the child's own id *and* the
   parent's `agencyId`) so a guessed child id from another tenant returns nothing.

`agencyId` appears on 51 references across `src/lib/schema.ts` — every tenant root
table and audit/notification table carries it, with `onDelete: "cascade"` back to
`agency` so deleting a tenant removes all of its data.

### Verification harness

`scripts/test-tenant-isolation.ts` (Wave 6) seeds two full agencies (A and B) with
rows in every tenant table plus child tables, then asserts:

1. Every agency-root query scoped to A excludes B's rows (and vice-versa).
2. The exact `findFirst(id=B, agencyId=A)` pattern the actions/pages use returns
   nothing (no cross-tenant read by guessed id).
3. Child rows can't be reached via the other agency's parent (the double-constraint
   pattern used by booking/product child mutations).
4. References are unique **per** agency — the same `BKG-5001` inserts cleanly into
   both agencies (would collide under a global unique).
5. The activity log and notifications are agency-scoped.

It always cleans up its two test agencies (cascade) at the end. Run it against a
non-prod DB:

```bash
npx tsx --env-file=.env scripts/test-tenant-isolation.ts
```

## Authentication

Staff authentication is **Better Auth** (`better-auth@^1.6.11`) with email/password,
configured in `src/lib/auth.ts` over the Drizzle Postgres adapter. Sessions are
resolved server-side with `auth.api.getSession()` inside `requireUser()`.

| Setting | Value / source | Purpose |
|---|---|---|
| `emailAndPassword.enabled` | `true` | Email + password sign-in (Better Auth hashes passwords). |
| `emailVerification.sendOnSignUp` | `true` | Sends a verification email on registration. |
| `sendResetPassword` | Resend (or console fallback) | Password-reset email flow. |
| `baseURL` / `trustedOrigins` | `BETTER_AUTH_URL` → `NEXT_PUBLIC_APP_URL` → `http://localhost:3000` | Restricts trusted origins to the deployed domain. |
| `BETTER_AUTH_SECRET` | env (validated `min(32)` in `src/lib/env.ts`) | Session signing secret; startup fails if missing. |

There are **no social/OAuth providers wired up** in `auth.ts` — although
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are declared *optional* in
`src/lib/env.ts`, no `socialProviders` block exists, so Google sign-in is not active.

### Invitation-only signup

Registration is **invitation-only**, enforced in the Better Auth `user.create.before`
database hook (`src/lib/auth.ts`):

- The hook calls `findPendingInviteByEmail()` (`src/lib/invites.ts`). If no pending,
  unexpired `agency_invite` matches the email, it throws `APIError("FORBIDDEN")` —
  this is the single enforcement point, so it also blocks direct calls to the public
  sign-up endpoint.
- On a match it stamps `agencyId` + `role` from the invite and forces
  `isPlatformAdmin: false`, `active: true`.
- The `user.create.after` hook consumes the invite via `markInviteAccepted()`.

The tenant/role columns (`agencyId`, `isPlatformAdmin`, `role`, `active`) are declared
as Better Auth `additionalFields` with `input: false`, so a client **cannot** set them
during sign-up — only the server hook can.

Invite tokens are generated with `randomBytes(24).toString("base64url")` and have a
**7-day TTL** (`INVITE_TTL_DAYS`, `src/lib/invites.ts`). Lookups require the invite to
be `status: "pending"` and `expiresAt > now`.

### Account deactivation

A deactivated team member (`active === false`) is signed out on their next request:
`requireUser()` redirects them to `/login?error=account_disabled`.

## Authorization guards

`src/lib/permissions.ts` provides the guard set. Each runs at the top of a protected
page/layout/action and **redirects** (never silently continues) when the check fails.

| Guard | Requirement | On failure |
|---|---|---|
| `requireUser()` | Valid session; not deactivated | `/login` (or `/login?error=account_disabled`) |
| `requireAgencyUser()` | Belongs to an agency; agency `active`; subscription not blocking | `/platform`, or `/login?error=agency_suspended` / `?error=subscription_inactive` / `?error=no_agency` |
| `requireManager()` | `canManageTeam(role)` (admin/manager) | `/dashboard` |
| `requireCapability(check, redirectTo?)` | Arbitrary capability helper from `@/lib/domain` | `redirectTo` (default `/dashboard`) |
| `requirePlatformAdmin()` | `isPlatformAdmin === true` | `/dashboard` |
| `getOptionalUser()` | — (never redirects) | returns `null` |

`requireAgencyUser()` additionally re-reads the agency's `status` and
`subscriptionStatus` on every call: a **suspended** agency (`status !== "active"`) or
one whose subscription is in a blocking state locks out its real members. Blocking
subscription states are `canceled`, `unpaid`, and `incomplete_expired`
(`BLOCKING_SUBSCRIPTION_STATUSES` in `src/lib/billing/stripe.ts`); `NULL` / `trialing`
/ `active` all pass. The platform admin is exempt from these locks so they can still
"view as" the agency for support.

### Roles & capabilities

Five roles are defined in `src/lib/domain.ts` (`USER_ROLES`):
`admin`, `manager`, `finance`, `support`, `agent`. Capability helpers gate features:

| Helper | Roles allowed | Gates |
|---|---|---|
| `seesAllData` | admin, manager, finance, support | Agency-wide visibility; **agents see only their own** rows (applied on the clients / products / opportunities / bookings / operations / dashboard list pages) |
| `canManageTeam` | admin, manager | Team & role management (`requireManager`) |
| `canAssignAdmin` | admin | Grant/change the **admin** role (prevents privilege escalation) |
| `canManagePayments` / `canViewFinance` | admin, manager, finance | Payments & finance — `recordPayment`/`deletePayment`/`createPaymentLink` require `canManagePayments`; `getCommissions`/`getCommissionsByBooking`/`getCommissionSummary` require `canViewFinance` (an agent gets an empty result, not an error) |
| `canDeleteRecords` | admin, manager | Deleting records |
| `canViewSupport` | admin, manager, support | Support workspace |

Capability rules are documented in
[business-rules.md](business-rules.md#roles--capabilities). Only an **admin** can
assign/change the admin role.

## Platform admin & impersonation

- The platform admin (vendor) has `isPlatformAdmin = true` and `agencyId = null`; they
  sit above all tenants and are routed to `/platform`. Because they have no agency,
  `requireAgencyUser()` sends them to their console and they **cannot enter a tenant
  except via impersonation**. Promotion is a deliberate, out-of-band step via
  `scripts/make-platform-admin.ts <email>`.
- Impersonation is **cookie-driven and platform-admin only**, set by Server Actions in
  `src/lib/actions/platform.ts` (each first re-checks `requirePlatformAdmin()`):

  | Action | Cookie set | Effect resolved in `requireUser()` |
  |---|---|---|
  | `viewAsAgency(agencyId)` | `platform_view_agency` | Adopt that `agencyId` with `role = "admin"` |
  | `viewAsUser(userId)` | `platform_view_user` | Adopt the target user's identity, `agencyId` **and role** (full fidelity) |
  | `exitAgencyView()` | deletes both | Return to `/platform` |

  Both cookies are `httpOnly`, `sameSite: "lax"`, and `secure` in production.
  `platform_view_user` takes precedence over `platform_view_agency`.
  `isPlatformAdmin` stays `true` throughout so `/platform` still recognizes them and
  the app shows a persistent "viewing as" exit banner. See
  [architecture.md](architecture.md#impersonation-cookie-driven-platform-admin-only).

## Client portal sessions

The Traveler Portal (`/portal`) is a **passwordless magic-link** system entirely
separate from Better Auth (staff) sessions. Helpers live in
`src/lib/portal-session.ts`; the flow spans `src/app/api/portal/auth/{request,verify,signout}`.

| Property | Value | Source |
|---|---|---|
| Session store | `portal_session` row (`portalSession`), scoped to one `client` | `src/lib/schema.ts` |
| Cookie | `portalSessionToken` — `httpOnly`, `sameSite: "lax"`, `secure` in prod | `portal-session.ts` |
| Magic-link token | `randomBytes(32).hex`, **15-minute** TTL | `api/portal/auth/request` |
| Session token | `randomBytes(32).hex`, **7-day** TTL | `api/portal/auth/verify` |
| `purpose` | `'magic'` \| `'session'` (default `'session'`) | `portal_session.purpose` (migration `0021`) |

Security properties of the flow:

- **No account enumeration.** `POST /api/portal/auth/request` always responds
  `{ ok: true }` whether or not the email matched a client, so it never reveals which
  addresses have a portal account.
- **Single-use links.** On `GET /api/portal/auth/verify`, a valid magic token is
  **rotated** into a fresh long-lived session token (the row's `token` is replaced), so
  the original link can't be replayed. Invalid/expired tokens bounce to
  `/portal/login?error=…`.
- **Purpose-scoped tokens.** `portal_session.purpose` discriminates a short-lived
  magic-link row (`'magic'`) from a real session row (`'session'`). `verify`
  only accepts a row with `purpose = 'magic'`; `getPortalSession()` (the session
  lookup used on every portal request) only accepts `purpose = 'session'`. A
  magic token can therefore no longer double as a session bearer for its
  15-minute window. Requesting a new magic link also retires any prior pending
  magic-link rows for that client, so old links can't accumulate as still-valid
  bypasses.
- **Tenant scoping.** A portal session points at exactly one `clientId`; the client's
  `agencyId` is reached through the relation, so portal reads stay within that client's
  agency. Deleting a client cascades to its portal sessions.
- **Sign-out** clears the browser cookie (`clearPortalSession()` / the signout route).

## Webhooks

The only inbound webhooks are **Stripe**. Duffel (flights) and Hotelbeds (hotels) are
consumed as request/response REST APIs — there are no supplier webhook endpoints.

Both Stripe routes verify the signature **before** acting and read the **raw** request
body via `req.text()` (never `req.json()`), which is required for HMAC verification:

| Route | Plane | Endpoint secret | Acts on |
|---|---|---|---|
| `api/stripe/webhook` | SaaS subscriptions (vendor → agency) | `STRIPE_WEBHOOK_SECRET` | `customer.subscription.{created,updated,deleted}` → reconcile `agency` subscription fields |
| `api/stripe/connect-webhook` | Booking payments (traveler → agency) | `STRIPE_CONNECT_WEBHOOK_SECRET` | `checkout.session.completed` (paid) → mark `payment` completed |

Verification is done **manually with Node `crypto`** (no Stripe SDK), in
`verifyWebhookSignature()` (`src/lib/billing/stripe.ts`):

- Parses the `Stripe-Signature` header (`t` timestamp + one or more `v1` signatures).
- **Replay protection:** rejects the event if `|now − t| > 300s` (the tolerance
  window).
- Recomputes `HMAC-SHA256(secret, "{t}.{rawBody}")` and compares against each `v1`
  signature with `timingSafeEqual` (constant-time) after a length check.
- Returns the parsed event only on success, otherwise `null`.

Handler responses are chosen so Stripe retries appropriately: a bad/missing signature
returns **400** (`Invalid signature`), a missing endpoint secret returns **503**
(`not configured` — transient, so Stripe keeps retrying), and a transient DB write
failure returns **500** so the idempotent update is retried. Non-targeted event types
are acked with **200** so Stripe stops retrying them.

## Database safety

Prod and dev historically shared one Neon database, so destructive scripts (seeding,
the isolation test, resets) are gated by `assertSafeDestructiveTarget()` in
`scripts/guard.ts`. A target is **protected** when:

- `NODE_ENV === "production"`, **or**
- the `POSTGRES_URL` host matches any comma-separated substring in
  `PROTECTED_DB_HOSTS` (set in the prod/Vercel env — the prod Neon branch host — never
  in local `.env`).

When the target is protected the script **throws and refuses to run** unless explicitly
overridden with `ALLOW_PROD=1`:

```bash
# Intentional prod run (rare, deliberate):
ALLOW_PROD=1 POSTGRES_URL=<prod> npx tsx scripts/backfill-countries.ts
```

Schema changes go through `db:generate` → `db:migrate`; **never** `db:push` (per
[AGENTS.md](../AGENTS.md)). All non-BetterAuth IDs are randomly-generated UUIDs
(`uuid().primaryKey().defaultRandom()`).

## Audit logging

Sensitive mutations write to the `activity_log` table (`activityLog` in
`src/lib/schema.ts`) via `logActivity`. Each row is **agency-scoped**
(`agencyId`, `onDelete: "cascade"`), records the actor (`userId`, `set null` on user
delete), plus `action`, `entityType`, `entityId`, an `entityLabel` retained even after
the entity is deleted, and optional `metadata`. Coverage is partial — `logActivity` is
called from ~11 action files, not universally.

## Known risks

- **Demo credentials in the repo.** `deployment.md` lists live demo passwords —
  including the platform super-admin account. They must be rotated or deleted before
  any real production use. See [deployment.md](deployment.md#demo-accounts).
- **No rate limiting.** Neither staff auth, the portal magic-link request endpoint, nor
  any API route is rate-limited, so they are exposed to brute-force / email-flooding.
- **Partial audit coverage.** Not every mutation writes to `activity_log`.
- **No app-level field encryption or GDPR export/erasure flow** (right-to-erasure is
  also blocked by the missing soft-delete). Tracked in the
  [gap tracker](roadmap.md#spec-vs-reality-gap-tracker).
- **Locale cookie gap** — cosmetic only; a fresh device shows English until the user
  re-picks (see [roadmap.md](roadmap.md) open items).
