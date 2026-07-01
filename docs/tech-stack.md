# Tech Stack

Atlas is a multi-tenant SaaS for travel agencies, built as a single Next.js
App-Router application. This document is the authoritative reference for the
exact frameworks, libraries, and external services in use — with the real
version numbers from `package.json` and the reason each one is here.

## At a glance

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS v4 (`@theme inline`), shadcn/ui (new-york), Lucide icons |
| Fonts | Geist (sans/mono), IBM Plex Sans Arabic (RTL) |
| Auth | Better Auth (email/password, invitation-gated) |
| Database | PostgreSQL (Neon) + Drizzle ORM (`postgres-js` driver) |
| i18n | next-intl 4 (cookie-based, no URL routing) — `en` · `fr` · `ar` (RTL) |
| Charts | recharts 3 (tokenized) |
| AI | Vercel AI SDK + OpenRouter |
| Email | Resend (transactional: invites, verification, password reset, proposals) |
| Billing | Stripe subscriptions (vendor → agency) + webhook |
| Payments | Stripe Connect (traveler → agency, destination charges) |
| Flights | Duffel (Amadeus self-service kept only as legacy fallback) |
| Hotels | Hotelbeds (APITUDE: availability + content) |
| PDF | `@react-pdf/renderer` (server-rendered proposals) |
| Data export | `exceljs` (XLSX) + built-in CSV (UTF-8 BOM) for BI/Power BI |
| Storage | Vercel Blob (optional) |
| Validation | Zod 4 (env schema, action inputs, AI structured output) |
| Hosting | Vercel + GitHub auto-deploy |

Every external integration **degrades gracefully when unconfigured** — see
[api-integrations.md](api-integrations.md). Flights fall back to sample data,
hotels to placeholder photos, email to console logging, billing/AI to disabled.

## Core framework & language

| Package | Version | Role |
|---|---|---|
| `next` | `16.1.6` | App-Router framework; RSC, Server Actions, route handlers, image optimization, rewrites/redirects/headers |
| `react` / `react-dom` | `19.2.4` | UI runtime (React 19 — Server Components, Actions) |
| `typescript` | `^5.9.3` | Language; strict compiler settings (see below) |
| `@types/node` | `^20.19.41` | Node type definitions |
| `@types/react` / `@types/react-dom` | `19.2.5` / `19.2.3` | React type definitions |

**Dev server** runs with Turbopack (`next dev --turbopack`). There is **no
`middleware.ts`** in the project — request-time locale resolution and auth
gating are handled inside `src/i18n/request.ts` and server components / layouts
respectively, not in Edge middleware.

### TypeScript configuration

`tsconfig.json` runs in **maximum-strict mode**. Beyond `strict: true`, it
additionally enables:

- `noUncheckedIndexedAccess` — indexed access yields `T | undefined`
- `exactOptionalPropertyTypes` — `?` and `| undefined` are distinct
- `noUnusedLocals` / `noUnusedParameters`
- `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`
- `forceConsistentCasingInFileNames`

Module resolution is `bundler`, target `ES2017`, `jsx: react-jsx`, and the
`@/*` path alias maps to `./src/*`. The `create-agentic-app` scaffold folder is
excluded from the program. Type-checking runs via `pnpm typecheck` (`tsc
--noEmit`).

### Next.js configuration (`next.config.ts`)

Wrapped with `createNextIntlPlugin()` from next-intl. Notable settings:

- **`images.remotePatterns`** — allow-listed image hosts: Google/GitHub avatars,
  `*.public.blob.vercel-storage.com` (Vercel Blob), `photos.hotelbeds.com`
  (GIATA hotel/room CDN), and `picsum.photos` / `fastly.picsum.photos`
  (placeholder photos when live supplier data is unavailable).
- **`compress: true`** — gzip response compression.
- **URL canonicalization** — `rewrites()` serve `/proposals/*` from the
  `/products/*` page files and `/sourcing/hotels/*` from `/hotels/*`;
  `redirects()` send `/products/*` → `/proposals/*` (permanent) and legacy
  `/search`, `/hotels/*`, `/operations` to their new canonical paths (temporary).
- **Security headers** applied to all routes: `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `X-XSS-Protection: 1; mode=block`, and a
  `Permissions-Policy` disabling camera/microphone/geolocation. See
  [security.md](security.md).

## Styling & UI

| Package | Version | Role |
|---|---|---|
| `tailwindcss` | `^4.3.0` | Utility-first CSS (v4, CSS-first config) |
| `@tailwindcss/postcss` | `latest` | Tailwind's PostCSS plugin (the only PostCSS plugin configured) |
| `tw-animate-css` | `^1.4.0` | Animation utilities (dialogs/dropdowns), imported in `globals.css` |
| `shadcn` | `^3.8.5` | Component generator CLI (new-york style, neutral base) |
| `radix-ui` | `^1.6.0` | Unstyled primitives (meta-package) — used by newer components (tabs, tooltip, breadcrumb) |
| `@radix-ui/react-*` | see below | Individual Radix primitives underpinning shadcn components |
| `lucide-react` | `^0.539.0` | Icon set |
| `class-variance-authority` | `^0.7.1` | Variant-driven class composition (buttons, badges) |
| `clsx` | `^2.1.1` | Conditional class strings |
| `tailwind-merge` | `^3.6.0` | Dedupe/merge Tailwind classes (`cn()` helper) |
| `next-themes` | `^0.4.6` | Class-based dark mode (system default, 3-way toggle) |
| `sonner` | `^2.0.7` | Toast notifications |
| `prettier-plugin-tailwindcss` | `^0.6.14` | Sorts Tailwind classes on format |

Individually installed Radix primitives: `@radix-ui/react-avatar` `^1.1.11`,
`@radix-ui/react-dialog` `^1.1.15`, `@radix-ui/react-dropdown-menu` `^2.1.16`,
`@radix-ui/react-label` `^2.1.8`, `@radix-ui/react-popover` `^1.1.17`,
`@radix-ui/react-slot` `^1.2.4`.

**Tailwind v4 is configured CSS-first** — there is **no `tailwind.config.ts`**.
`src/app/globals.css` starts with `@import "tailwindcss";` and `@import
"tw-animate-css";`, then defines the theme in an `@theme inline { … }` block that
bridges CSS custom properties (colors, radius, shadows, sidebar tokens, chart
palette, keyframe animations) to Tailwind utilities. Light-theme tokens are exact
marketing-deck hex values; the `.dark` selector swaps them. `postcss.config.mjs`
lists a single plugin, `@tailwindcss/postcss`. shadcn wiring lives in
`components.json` (`style: new-york`, `rsc: true`, `baseColor: neutral`,
`cssVariables: true`, `iconLibrary: lucide`, css → `src/app/globals.css`).

The full visual system — tokens, type scale, spacing, component variants — is
defined in [`DESIGN.md`](../DESIGN.md); see also [ui-ux.md](ui-ux.md).

### Fonts

Loaded via `next/font/google` in `src/app/layout.tsx`:

| Font | CSS variable | Subset | Usage |
|---|---|---|---|
| Geist | `--font-geist-sans` | latin | All UI text |
| Geist Mono | `--font-geist-mono` | latin | Monospace/code |
| IBM Plex Sans Arabic | `--font-arabic` | arabic (weights 400/500/600/700) | Applied via `[dir="rtl"]` for the Arabic locale |

## Authentication

| Package | Version | Role |
|---|---|---|
| `better-auth` | `^1.6.11` | Session/auth engine (email + password) |
| `@better-auth/api-key` | `^1.6.11` | API-key plugin (installed; not currently wired into `auth.ts`) |

`src/lib/auth.ts` configures Better Auth with the **Drizzle adapter**
(`drizzleAdapter(db, { provider: "pg" })`). Email/password sign-in is enabled;
email verification is sent on sign-up. The base URL / trusted origin resolves
from `BETTER_AUTH_URL` → `NEXT_PUBLIC_APP_URL` → `http://localhost:3000`.

**Registration is invitation-only.** A `databaseHooks.user.create.before` hook
looks up a pending invite by email (`findPendingInviteByEmail`) and rejects
sign-up with a `FORBIDDEN` `APIError` if none exists — this is also the
enforcement point that blocks direct calls to the public sign-up endpoint. The
matching invite determines the new user's `agencyId` and `role`; the `after`
hook consumes the invite (`markInviteAccepted`). Application columns
(`agencyId`, `isPlatformAdmin`, `role`, `active`) are exposed as
`user.additionalFields` with `input: false`, so they ride along on the session
but cannot be set by clients. Password-reset and verification emails are sent
through the Resend-backed `sendEmail` helper (console fallback when Resend is
unconfigured). Tenant/role authorization details are in
[security.md](security.md) and [business-rules.md](business-rules.md).

## Database & ORM

| Package | Version | Role |
|---|---|---|
| `drizzle-orm` | `^0.44.7` | Type-safe query builder / schema |
| `drizzle-kit` | `^0.31.10` | Migration generation & runner (dev dependency) |
| `postgres` | `^3.4.9` | `postgres-js` driver used at runtime |
| `pg` | `^8.20.0` | node-postgres (installed alongside `@types/pg`; not the runtime driver) |
| `@types/pg` | `^8.20.0` | Types for `pg` |

The runtime connection (`src/lib/db.ts`) uses the **`postgres-js`** driver:
`drizzle(postgres(POSTGRES_URL), { schema })`. The connection string is read
through the validated env accessor (`getServerEnv()`), so a missing/malformed
`POSTGRES_URL` fails fast with a clear message. The database is PostgreSQL,
hosted on **Neon** in production.

`drizzle.config.ts` sets `dialect: "postgresql"`, `schema:
"./src/lib/schema.ts"`, `out: "./drizzle"`, and reads `POSTGRES_URL` for
credentials. Schema-change workflow (per [`AGENTS.md`](../AGENTS.md)):

```bash
pnpm db:generate   # drizzle-kit generate — write a new migration
pnpm db:migrate    # drizzle-kit migrate  — apply migrations
```

**Never run `drizzle-kit push`** for schema changes. All non-BetterAuth ID
columns are randomly generated UUIDs. The full schema and table catalog live in
[database.md](database.md).

## Internationalization

| Package | Version | Role |
|---|---|---|
| `next-intl` | `^4.13.0` | Message catalogs, formatting, request-scoped locale |

i18n is **cookie-based with no URL-locale routing** — existing routes are
unchanged. `src/i18n/config.ts` declares three locales: `en` (default), `fr`,
and `ar` (right-to-left). The active locale is read from the `locale` cookie in
`src/i18n/request.ts` (`getRequestConfig`), which loads
`src/messages/{locale}.json`. Direction (`ltr`/`rtl`) is derived per-locale;
the Arabic locale triggers `[dir="rtl"]` and the IBM Plex Sans Arabic font. The
next-intl plugin is enabled in `next.config.ts`.

## AI

| Package | Version | Role |
|---|---|---|
| `ai` | `^5.0.188` | Vercel AI SDK core (`streamText`, `generateText`, `generateObject`) |
| `@ai-sdk/react` | `^2.0.190` | React hooks (`useChat`) for the assistant UI |
| `@openrouter/ai-sdk-provider` | `^1.5.4` | OpenRouter provider for the AI SDK |
| `react-markdown` | `^10.1.0` | Renders assistant markdown responses |

The model provider is **OpenRouter**, created with
`createOpenRouter({ apiKey })` from `OPENROUTER_API_KEY`. The default model is
read from `OPENROUTER_MODEL` (env default `openai/gpt-5-mini`). The chat route
(`src/app/api/chat/route.ts`) streams responses with `streamText`; server
actions in `src/lib/actions/ai.ts` use `generateObject` (Zod-typed structured
output) and `generateText` for one-shot generation. AI features are disabled
(with a startup warning) when `OPENROUTER_API_KEY` is unset. See [ai.md](ai.md).

## External services & suppliers

All third-party APIs below are called over **raw `fetch`** — no vendor SDKs are
installed. Each reads its credentials from env and no-ops (or returns sample
data) when unconfigured.

| Service | Package / transport | Purpose |
|---|---|---|
| Resend | `resend` `^6.14.0` | Transactional email (invites, verification, password reset, proposal delivery) |
| Stripe (billing) | REST over `fetch` (no SDK) | Vendor → agency SaaS subscriptions |
| Stripe (payments) | REST over `fetch` (no SDK) | Traveler → agency booking payments via Connect (destination charges) |
| Duffel | REST over `fetch` (no SDK) | Flight search & booking (primary) |
| Amadeus | REST over `fetch` (no SDK) | Legacy flight fallback only |
| Hotelbeds | REST over `fetch` (no SDK) | Hotel availability & content (APITUDE) |
| Vercel Blob | `@vercel/blob` `^2.3.3` | Optional file storage |

### Stripe

Two intentionally separate planes, both hitting `https://api.stripe.com/v1`
directly via `fetch`:

- **Billing** (`src/lib/billing/stripe.ts`) — the platform charges each agency a
  recurring subscription. Active only when `STRIPE_SECRET_KEY` is set. Webhook
  signatures are verified manually with Node's `crypto` (`createHmac`,
  `timingSafeEqual`). Blocking subscription statuses (`canceled`, `unpaid`,
  `incomplete_expired`) lock an agency out.
- **Payments** (`src/lib/payments/stripe.ts`) — traveler → agency booking
  payments through Stripe Connect (destination charges), with a configurable
  platform fee (`STRIPE_PLATFORM_FEE_PERCENT`, default `5`).

### Duffel & Hotelbeds

- **Duffel** (`src/lib/suppliers/duffel.ts`, `providers/duffel-provider.ts`) —
  base URL `https://api.duffel.com`; every request carries a `Duffel-Version`
  header (from `DUFFEL_VERSION`, default `v2`).
- **Hotelbeds** (`src/lib/suppliers/hotelbeds.ts`,
  `providers/hotelbeds-provider.ts`) — base URL `https://api.hotelbeds.com`;
  every request carries an `Api-key` header plus an `X-Signature` (SHA-256 of
  key + secret + timestamp).

Full endpoint/env details are in [api-integrations.md](api-integrations.md).

## Documents, export & utilities

| Package | Version | Role |
|---|---|---|
| `@react-pdf/renderer` | `^4.5.1` | Server-rendered proposal PDFs (`/proposal/[id]/pdf`, `/p/[token]/pdf` route handlers) |
| `exceljs` | `^4.4.0` | XLSX export (`src/lib/export/xlsx.ts`); CSV export is hand-rolled with a UTF-8 BOM for Excel/Power BI |
| `zod` | `^4.4.3` | Runtime validation — env schema, server-action inputs, AI structured output |
| `date-fns` | `^4.4.0` | Date math/formatting (date-range picker, etc.) |
| `react-day-picker` | `^10.0.1` | Calendar primitive behind the date-range picker |

## Tooling, quality & scripts

| Package | Version | Role |
|---|---|---|
| `eslint` | `^9.39.4` | Linting (flat config) |
| `eslint-config-next` | `16.0.7` | Next.js core-web-vitals ruleset |
| `prettier` | `^3.8.3` | Formatting |
| `tsx` | `^4.21.0` | Run TS scripts (`scripts/*.ts`, setup) |

`eslint.config.mjs` extends `eslint-config-next/core-web-vitals` and adds
project rules: enforced `import/order` grouping (react/next/`@/` ordered),
`no-console` (warn, `warn`/`error` allowed), `prefer-const`, `no-var`, and
`eqeqeq` (always, null-ignored). `.next`, `drizzle`, `scripts`, and
`create-agentic-app` are ignored.

Key scripts (`package.json`):

```bash
pnpm dev          # next dev --turbopack
pnpm build        # db:migrate, then next build
pnpm build:ci     # next build only (used by CI/Vercel)
pnpm lint         # eslint .
pnpm typecheck    # tsc --noEmit
pnpm check        # lint + typecheck
pnpm format       # prettier --write .
pnpm db:generate  # drizzle-kit generate
pnpm db:migrate   # drizzle-kit migrate
pnpm db:studio    # drizzle-kit studio
```

Environment variables are validated centrally in `src/lib/env.ts` (Zod). Only
`POSTGRES_URL` is strictly required; everything else is optional and produces a
startup warning when missing (see `checkEnv()`). Env-var reference:
[api-integrations.md](api-integrations.md).

## Hosting & deployment

Deployed on **Vercel** with GitHub auto-deploy. `vercel.json` pins
`framework: nextjs`, `buildCommand: npm run db:migrate && npm run build:ci`
(migrations run before the build), and `installCommand: npm install
--legacy-peer-deps`. Deployment specifics are in [deployment.md](deployment.md).

## Conventions tied to the stack

- **Styling** follows the design system in [`DESIGN.md`](../DESIGN.md); see
  [ui-ux.md](ui-ux.md).
- **Working conventions** (sub-agents, UUID ids, Drizzle workflow, testing) live
  in [`AGENTS.md`](../AGENTS.md); see [coding-standards.md](coding-standards.md).
- **External integrations** and their env vars are documented in
  [api-integrations.md](api-integrations.md). Every one degrades gracefully when
  unconfigured.
- **Tailwind v4** is configured CSS-first via `@theme inline` in `globals.css` —
  there is no `tailwind.config.ts`.
