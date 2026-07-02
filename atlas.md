# Atlas — Documentation Index

> **Atlas is the operating system for modern travel agencies.**
> Every decision should support that sentence.

Atlas is a **multi-tenant SaaS for travel agencies**. Each agency runs its
clients, sales pipeline, proposals, bookings and finance in a fully isolated
workspace; the vendor manages every agency from a platform console. Multilingual
(EN/FR/AR with RTL), deployed on Vercel with GitHub auto-deploy.

- **Live:** https://agencetool.vercel.app
- **Repo:** github.com/ouks1993/agence_tool
- **Vendor console:** https://agencetool.vercel.app/platform

This is the reference index. The detailed reference is split into focused docs
under [`docs/`](docs/). See also `DESIGN.md` (design system) and
`AGENTS.md`/`CLAUDE.md` (working conventions) — those remain the source of truth
for UI and coding conventions respectively.

---

## Documentation map

| Doc | Covers |
|---|---|
| [Vision](docs/vision.md) | What Atlas is, who it's for, operating model, features at a glance |
| [Architecture](docs/architecture.md) | Multi-tenancy · auth · platform admin · impersonation · roles · route map · module layout · i18n |
| [Tech stack](docs/tech-stack.md) | Framework, libraries, services |
| [Domain model](docs/domain.md) | Core entities, the Lead→…→Feedback chain, aggregates & ownership |
| [Database](docs/database.md) | Schema tables, tenancy columns, migrations, ID convention |
| [API integrations](docs/api-integrations.md) | Duffel · Hotelbeds · Stripe (billing + Connect) · Resend · Gemini / OpenRouter · Blob |
| [Development guide](docs/development-guide.md) | Setup, env vars, commands, scripts, DB workflow |
| [Coding standards](docs/coding-standards.md) | → points to `AGENTS.md`; conventions summary |
| [UI / UX](docs/ui-ux.md) | → points to `DESIGN.md`; product UX patterns |
| [Business rules](docs/business-rules.md) | RBAC, currency, booking lifecycle, commissions, vocabularies |
| [Deployment](docs/deployment.md) | Vercel, env, prod migrations, demo accounts |
| [Roadmap & changelog](docs/roadmap.md) | Phase status, open items, commit changelog |
| [Security](docs/security.md) | Tenant isolation, auth, guards, webhooks, DB safety, known risks |
| [Analytics & BI](docs/analytics.md) | Dashboards, currency-safe metrics, CSV/Excel export |
| [AI](docs/ai.md) | Assistant + inline AI features |

---

## At a glance

- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 +
  shadcn/ui · PostgreSQL (Neon) + Drizzle · Better Auth · next-intl ·
  Stripe + Stripe Connect · Resend · Duffel (flights) · Hotelbeds (hotels) ·
  Vercel AI SDK + Google Gemini (primary) / OpenRouter (fallback) · Vercel.
- **Tenancy:** every business row is scoped to an `agencyId`; enforced via
  `requireAgencyUser()`. Vendor platform admin sits above all tenants.
- **Roles:** admin · manager · finance · support · agent — each with a tailored
  landing and nav.
- **Deploy:** push to `main` → Vercel auto-deploys production.
- **DBs:** dev `ep-wandering-sunset-aitlty78` · prod `ep-misty-thunder-aixz34vy`.
  Run `POSTGRES_URL=<prod-url> npx drizzle-kit migrate` after each schema change.

Phases 1–3 + UX + Data-quality/BI + Sprint 1 (booking) + Sprint 2 (Travel Platform)
complete, plus a full **marketing-grade UI redesign** of every screen (Phases 0–5).
Multi-tenant SaaS with live travel sourcing, billing, client portal,
supplier/commission management, and AI throughout. Real supplier search and
booking (Duffel + Hotelbeds) fully wired behind a provider-agnostic Travel Platform
facade — activate with production credentials. Adding a new provider requires zero
consumer changes. Migrations: 25 (latest `0024` — per-deal deposit override).

**Shipped since:**
- **UI redesign — complete.** Every one of the 55 routes brought to the sales-deck
  standard: shared design tokens + primitives, ⌘K command palette + mobile tab bar,
  a unified `StatStrip` KPI band app-wide, and per-screen rebuilds. See
  [specs/ui-redesign/PLAN.md](specs/ui-redesign/PLAN.md) and
  [decision 0005](docs/decisions/0005-app-ui-redesign.md). `marketing/` holds the deck,
  11 mockups, the demo dataset, and the design guide.
- **AI — Google Gemini** is the primary provider (`@ai-sdk/google`, OpenRouter
  fallback). The `/assistant` answers across **every data domain** (bookings, clients,
  proposals, pipeline, finance, commissions) via tenant-safe read tools, keeps a live
  client/booking context rail, and respects platform-admin "view as". See
  [docs/ai.md](docs/ai.md).
- **Auto-booking** — accepting + signing a proposal now auto-creates a booking in
  `awaiting_payment` (idempotent, tenant-safe). See
  [docs/business-rules.md](docs/business-rules.md) and
  [decision 0006](docs/decisions/0006-auto-booking-on-proposal-accept.md).
