# Architecture

← Back to [Atlas index](../../atlas.md)

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 (`@theme inline`), shadcn/ui (new-york), Lucide icons |
| Fonts | Geist (sans/mono), IBM Plex Sans Arabic (RTL) |
| Auth | Better Auth (email/password, invitation-gated) |
| Database | PostgreSQL (Neon) + Drizzle ORM |
| i18n | next-intl 4 (cookie-based, no URL routing) |
| Charts | recharts 3 (tokenized) |
| AI | Vercel AI SDK + OpenRouter |
| Email | Resend (transactional: invites, password reset, proposals) |
| Billing | Stripe subscriptions (vendor → agency) + webhook |
| Flights | Duffel (Amadeus self-service kept only as legacy fallback) |
| Hotels | Hotelbeds (APITUDE: availability + content) |
| PDF | `@react-pdf/renderer` (server-rendered proposals) |
| Storage | Vercel Blob (optional) |
| Hosting | Vercel + GitHub auto-deploy |

---

## Architecture

### Multi-tenancy
Every business table carries `agencyId` (tenant roots) or inherits it through a
parent (children). **All** reads/writes are scoped by agency, enforced in actions
and pages via `requireAgencyUser()` → `user.agencyId`. References (`BKG-…`,
`PRD-…`) are unique **per agency**. Re-verified by `scripts/test-tenant-isolation.ts`.

### Auth & onboarding
- Better Auth (`src/lib/auth.ts`) — email/password. The `user.create.before` hook
  makes signup **invitation-only**: it requires a pending `agency_invite` matching
  the email, stamps `agencyId` + role, and rejects everyone else (blocks the raw
  signup endpoint too). `BETTER_AUTH_URL`/`baseURL` + `trustedOrigins` set so the
  deployed domain is trusted.
- Guards (`src/lib/permissions.ts`): `requireUser`, `requireAgencyUser`
  (tenant + agency-suspension lockout), `requireManager`, `requireCapability`,
  `requirePlatformAdmin`.

### Platform admin (vendor)
A user with `isPlatformAdmin = true`, `agencyId = null` — above all tenants,
routed to `/platform`. Cannot enter a tenant app except via impersonation.

### Impersonation (cookie-driven, platform-admin only)
- `viewAsAgency(agencyId)` → cookie `platform_view_agency` → acts as agency **admin**.
- `viewAsUser(userId)` → cookie `platform_view_user` (takes precedence) → adopts
  that user's identity, agency and **role** (full fidelity — an agent sees only
  their work).
- Resolved in `requireUser`; `user.impersonating` = `"agency" | "user" | null`
  drives the exit banner. `exitAgencyView()` clears both cookies.

### Per-role landing
`roleHome(role)` routes finance → `/finance`, support → `/support`, else
`/dashboard` (which itself adapts: agency-wide for admin/manager, scoped "Your
work" for agents). App-shell nav is role-aware via a `show(role)` predicate per item.

---

## Roles & permissions

Defined in `src/lib/domain.ts`.

| Role | Sees all data | Team mgmt | Payments | Finance view | Support view | Delete | Home |
|---|---|---|---|---|---|---|---|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | /dashboard |
| manager | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | /dashboard |
| finance | ✅ | — | ✅ | ✅ | — | — | /finance |
| support | ✅ | — | — | — | ✅ | — | /support |
| agent | own only | — | — | — | — | — | /dashboard (scoped) |

Capability helpers: `seesAllData`, `canManageTeam`, `canAssignAdmin`,
`canManagePayments`, `canViewFinance`, `canViewSupport`, `canDeleteRecords`,
`roleHome`. Only an **admin** can assign/change the admin role.
