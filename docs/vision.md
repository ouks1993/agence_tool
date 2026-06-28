# Vision

Atlas is a **multi-tenant SaaS for travel agencies**. Each agency runs its
clients, sales pipeline, proposals, bookings and finance in a fully isolated
workspace; the vendor manages every agency from a platform console. Multilingual
(EN/FR/AR with RTL), deployed on Vercel with GitHub auto-deploy.

- **Live:** https://agencetool.vercel.app
- **Repo:** github.com/ouks1993/agence_tool
- **Vendor console:** https://agencetool.vercel.app/platform

## Who it's for

A travel agency that books trips for clients and needs one tool to run the whole
lifecycle: capture leads, build and e-sign proposals, source flights/hotels,
manage bookings and travellers, take payments, and track commissions — without
juggling spreadsheets. The vendor (platform operator) sells the tool to many
agencies and bills them by subscription.

## Operating model

- **Per-agency isolation.** Every business record is scoped to an `agencyId`;
  agencies never see each other's data. Reference numbers (`BKG-…`, `PRD-…`) are
  unique per agency. See [architecture.md](architecture.md) and
  [security.md](security.md).
- **DZD-first, no FX.** The agency operates in Algerian Dinar. EUR/USD are
  supported for source data but Atlas never converts between currencies —
  analytics group by currency rather than summing across. See
  [business-rules.md](business-rules.md#currency).
- **Graceful degradation.** Every external integration (flights, hotels, email,
  payments, AI) falls back to sample/logged behaviour when its keys are unset, so
  the app runs end-to-end with only a database and an auth secret. See
  [api-integrations.md](api-integrations.md).

## Features at a glance

- **Core platform** — multi-tenancy, 5-role RBAC, invitation-only onboarding,
  vendor platform console, impersonation, per-role workspaces.
- **CRM & pipeline** — clients with contacts and a unified funnel timeline,
  opportunities, proposals with PDF + e-signature, one-click convert→booking.
- **Bookings** — full lifecycle with a visual stepper, trip services, travellers,
  payments, itinerary, vouchers/invoices, list/board toggle.
- **Supplier management** — directory, contracts & rates, supplier picker.
- **Commissions** — two-ledger tracking, auto-generated on confirm/ticket.
- **Client portal** — magic-link login, trip view, online payments, proposal
  signing.
- **Travel sourcing** — live flights (Duffel) and hotels (Hotelbeds), AI assistant.
- **AI inline features** — itinerary generation, quote builder, email drafting,
  visa assistant. See [ai.md](ai.md).
- **Analytics & BI** — decision dashboards + standardized CSV/Excel export. See
  [analytics.md](analytics.md).
- **SaaS billing** — Stripe subscriptions (vendor→agency) + Stripe Connect
  (traveler→agency).
- **i18n** — English / French / Arabic with full RTL.

See [roadmap.md](roadmap.md) for phase status and open items, and the
[index](../atlas.md) for the full documentation map.
