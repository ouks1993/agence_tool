# Atlas — Complete Reference

Atlas is a **multi-tenant SaaS for travel agencies**. Each agency runs its
clients, sales pipeline, proposals, bookings and finance in a fully isolated
workspace; the vendor manages every agency from a platform console. Multilingual
(EN/FR/AR with RTL), deployed on Vercel with GitHub auto-deploy.

- **Live:** https://agencetool.vercel.app
- **Repo:** github.com/ouks1993/agence_tool
- **Vendor console:** https://agencetool.vercel.app/platform

This is the reference index. The detailed reference is split into focused docs
under [`docs/atlas/`](docs/atlas/). See also `PROJECT.md` (short handbook),
`DESIGN.md` (design system), `AGENTS.md`/`CLAUDE.md` (working conventions).

---

## Documentation map

| Doc | Covers |
|---|---|
| [Architecture](docs/atlas/architecture.md) | Tech stack · multi-tenancy · auth & onboarding · platform admin · impersonation · per-role landing · roles & permissions |
| [Features](docs/atlas/features.md) | Full feature catalogue (RBAC, bookings, CRM, proposals, billing, travel sourcing, hotel module, AI, i18n) |
| [Routes](docs/atlas/routes.md) | App / platform / auth / public / API route map |
| [Database](docs/atlas/database.md) | Schema tables, tenancy columns, migrations |
| [Key modules](docs/atlas/modules.md) | `src/lib`, server actions, i18n, components layout |
| [Internationalization](docs/atlas/i18n.md) | Locales, RTL, how to translate a string |
| [Local development](docs/atlas/development.md) | Setup, env vars, dev/build commands, maintenance scripts |
| [Operations](docs/atlas/operations.md) | Deployment (Vercel) + demo accounts & demo flow |
| [Roadmap & changelog](docs/atlas/roadmap.md) | Phase status, open items, commit changelog |

---

## At a glance

- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 +
  shadcn/ui · PostgreSQL (Neon) + Drizzle · Better Auth · next-intl ·
  Stripe + Stripe Connect · Resend · Duffel (flights) · Hotelbeds (hotels) ·
  Vercel AI SDK + OpenRouter · Vercel.
- **Tenancy:** every business row is scoped to an `agencyId`; enforced via
  `requireAgencyUser()`. Vendor platform admin sits above all tenants.
- **Roles:** admin · manager · finance · support · agent — each with a tailored
  landing and nav.
- **Deploy:** push to `main` → Vercel auto-deploys production.
- **DBs:** dev `ep-dawn-voice-ai8d6q3o` · prod `ep-misty-thunder-aixz34vy`.
  Run `POSTGRES_URL=<prod-url> npx drizzle-kit migrate` after each schema change.

Phases 1–3 complete. Multi-tenant SaaS with live travel sourcing, billing,
client portal, supplier/commission management, and inline AI features.
Migrations: 16 (latest `0016`).
