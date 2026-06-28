# Security

## Tenant isolation

Every business table carries `agencyId` (root) or inherits it via a parent
(children). **All** reads/writes are scoped by agency through
`requireAgencyUser()` → `user.agencyId`. Reference numbers (`BKG-…`, `PRD-…`) are
unique per agency. Cross-tenant leakage is re-verified by
`scripts/test-tenant-isolation.ts` (seeds two agencies, asserts no leak, cleans
up). See [architecture.md](architecture.md#multi-tenancy).

## Authentication

- Better Auth (email/password). Signup is **invitation-only**: the
  `user.create.before` hook requires a matching pending `agency_invite`, stamps
  `agencyId` + role, and rejects everyone else — this also blocks the raw signup
  endpoint.
- `BETTER_AUTH_URL` / `baseURL` + `trustedOrigins` restrict trusted origins to the
  deployed domain.
- Invite tokens have a 7-day TTL (`src/lib/invites.ts`).

## Authorization guards

`src/lib/permissions.ts`: `requireUser`, `requireAgencyUser` (tenant +
agency-suspension + lapsed-subscription lockout), `requireManager`,
`requireCapability`, `requirePlatformAdmin`. Capability rules in
[business-rules.md](business-rules.md#roles--capabilities). Only an **admin** can
assign/change the admin role.

## Platform admin & impersonation

- Platform admin: `isPlatformAdmin = true`, `agencyId = null`; sits above all
  tenants and **cannot enter a tenant except via impersonation**.
- Impersonation is **cookie-driven and platform-admin only**
  (`platform_view_agency` / `platform_view_user`), resolved in `requireUser`, with
  a persistent exit banner. See
  [architecture.md](architecture.md#impersonation-cookie-driven-platform-admin-only).

## Client portal sessions

Passwordless magic-link sessions (`portal_session`) are scoped to a single client
and **separate** from staff auth, stored in an httpOnly cookie
(`portal-session.ts`).

## Webhooks

Stripe webhooks use **manual signature verification** before acting:
`api/stripe/webhook` (subscriptions) and `api/stripe/connect-webhook` (Connect
payments). Secrets: `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`.

## Database safety

`PROTECTED_DB_HOSTS` makes destructive scripts **refuse to run against a protected
(prod) host** unless explicitly overridden with `ALLOW_PROD=1`. In production it is
set to the prod branch host `ep-misty-thunder-aixz34vy`. Schema changes go through
`db:generate` → `db:migrate`; **never** `db:push`.

## Known risks

- **Demo credentials in the repo.** `deployment.md` lists live demo passwords —
  including the platform super-admin account. They must be rotated or deleted
  before any real production use. See [deployment.md](deployment.md#demo-accounts).
- **Locale cookie gap** — cosmetic only; a fresh device shows English until the
  user re-picks (see [roadmap.md](roadmap.md) open items).
