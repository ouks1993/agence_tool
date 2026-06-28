# Tech Stack

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
| Payments | Stripe Connect (traveler → agency, destination charges) |
| Flights | Duffel (Amadeus self-service kept only as legacy fallback) |
| Hotels | Hotelbeds (APITUDE: availability + content) |
| PDF | `@react-pdf/renderer` (server-rendered proposals) |
| Data export | `exceljs` (XLSX) + built-in CSV (UTF-8 BOM) for BI/Power BI |
| Storage | Vercel Blob (optional) |
| Hosting | Vercel + GitHub auto-deploy |

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
