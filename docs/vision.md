# Vision

**Atlas exists to become the operating system of travel agencies.**

Today an agency runs on a patchwork of tools:

- Excel
- WhatsApp
- Email
- Booking portals
- Accounting software

Everything should happen inside Atlas instead — **one workspace**.

## Long-term goals

- CRM
- Sales
- Quotations
- Flight booking
- Hotel booking
- Supplier management
- Accounting
- Customer portal
- AI assistant
- BI
- Automation

## Operating model

- **Per-agency isolation.** Every business record is scoped to an `agencyId`;
  agencies never see each other's data. Reference numbers (`BKG-…`, `PRD-…`) are
  unique per agency. See [architecture.md](architecture.md) and
  [security.md](security.md).
- **Vendor + tenants.** The vendor (platform operator) sells Atlas to many
  agencies and bills them by subscription, managing all of them from a platform
  console. Each agency is a fully isolated tenant.
- **DZD-first, no FX.** The agency operates in Algerian Dinar. EUR/USD are
  supported for source data but Atlas never converts between currencies —
  analytics group by currency rather than summing across. See
  [business-rules.md](business-rules.md#currency).
- **Graceful degradation.** Every external integration (flights, hotels, email,
  payments, AI) falls back to sample/logged behaviour when its keys are unset, so
  the app runs end-to-end with only a database and an auth secret. See
  [api-integrations.md](api-integrations.md).

## Where it is today

Atlas is a deployed, multi-tenant SaaS — multilingual (EN/FR/AR with RTL), live on
Vercel with GitHub auto-deploy.

- **Live:** https://agencetool.vercel.app
- **Repo:** github.com/ouks1993/agence_tool
- **Vendor console:** https://agencetool.vercel.app/platform

Shipped against the long-term goals:

- **CRM** — clients with contacts and a unified funnel timeline.
- **Sales** — opportunities, pipeline stages, conversion analytics.
- **Quotations** — proposals with PDF + e-signature, one-click convert→booking,
  AI quote builder.
- **Flight booking** — live Duffel search (real order placement is pending).
- **Hotel booking** — live Hotelbeds search + content cache (real booking pending).
- **Supplier management** — directory, contracts & rates, supplier picker.
- **Customer portal** — magic-link login, trip view, online payments, proposal
  signing.
- **AI assistant** — agency-scoped chat + inline itinerary/quote/email/visa
  features. See [ai.md](ai.md).
- **BI** — decision dashboards + standardized CSV/Excel export. See
  [analytics.md](analytics.md).
- **Accounting** — partial: payments, two-ledger commissions, AR aging. Full
  accounting is a long-term goal.
- **Automation** — early: auto-generated commissions, lifecycle guards. Broader
  automation (e.g. quote-on-stage-change, WhatsApp) is on the
  [roadmap](roadmap.md).

## Atlas principles

The ten founding principles. Everything else — the design system, the never-rules,
the golden workflow — is an expression of these.

1. **Client first.** The client record is the spine; every workflow starts there.
2. **Every entity belongs to an agency.** Multi-tenancy is non-negotiable —
   `agencyId` on every business row, enforced on every read/write.
3. **No duplicated data.** One source of truth; canonical values over free text.
4. **Automation over manual work.** Generate, don't ask — quotes, itineraries,
   commissions, documents.
5. **Every workflow has one happy path.** A single, obvious golden route through
   each flow ([business-rules.md](business-rules.md#golden-workflow)).
6. **Managers need insight.** Decision-oriented analytics where managers land.
7. **Agents need speed.** Fast, scoped surfaces — minimal clicks, minimal waiting.
8. **Data quality > flexibility.** Constrain inputs to keep reporting clean.
9. **Everything is reversible.** Prefer soft state and undo over destructive
   operations.
10. **Every page answers "What do I do next?"** Always surface the next action;
    never a dead end.

These are operationalized as UI guardrails in
[ui-ux.md](ui-ux.md#atlas-design-principles), hard constraints in
[business-rules.md](business-rules.md#never-rules-hard-constraints), and tracked
against the code in the [gap tracker](roadmap.md#spec-vs-reality-gap-tracker).

See [roadmap.md](roadmap.md) for phase status and open items, and the
[index](../atlas.md) for the full documentation map.
