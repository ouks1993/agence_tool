# Phase 1 — "Sellable" Implementation Plan

Goal: take Atlas from demo to sellable. Seven features, dependency-ordered.

Decisions locked:
- **Billing:** vendor bills agencies (SaaS subscriptions) **now**; agencies bill
  travelers (Stripe Connect) **later**.
- **Email:** Resend · **Flights:** Amadeus · **Hotels:** Hotelbeds.

## Key findings (much is already partially built)

- **Email** — a SendGrid adapter already exists at `src/lib/notifications/email.ts`
  with the right `sendEmail()`/`EmailResult` contract. Resend = one-file swap.
  Gaps: invites never actually send (toast is cosmetic, delivery is copy-paste);
  both Better Auth hooks (`auth.ts:85-97`) only `console.log`.
- **Stripe** — a fetch-based Checkout integration already exists for *traveler*
  booking payments (`src/lib/payments/stripe.ts`); `STRIPE_SECRET_KEY` is in `.env`.
  SaaS subscriptions are a **separate billing plane** on the `agency` table.
- **Travel APIs** — `SupplierProvider` abstraction exists with a working **Amadeus
  implementation for flights AND hotels** (`src/lib/suppliers/`). Flights ~done.
- **Bug** — `products/[id]/page.tsx:61` links to `/products/${id}/proposal`, a route
  that doesn't exist (real one is `/proposal/[id]`). Fix during PDF/e-sign work.

## Sequence

```
1. DB split          ─ foundation; before billing & real customers
2. Email (Resend)    ─ unblocks invites, billing receipts, e-sign, proposals
3. Stripe SaaS billing ─ needs email + agency gating
4. PDF proposals ──┐  ─ pair
5. E-signature   ──┘    e-sign needs public token + email
6. Hotelbeds + flights  ─ parallel track, independent of 1–5
```

---

## 1. Separate databases — S (operational)
- Route `src/lib/db.ts:5-12` through `getServerEnv()` (currently bypasses zod).
- Add prod guard to destructive scripts (`seed-demo-data.ts`, `db:reset`,
  `test-tenant-isolation.ts`) — refuse unless `ALLOW_PROD=1` / host ≠ prod.
- User action: create a dev Neon branch; prod `POSTGRES_URL` only in Vercel env.
- Vercel `build:ci` skips migrations — confirm out-of-band migrate process.

## 2. Email delivery (Resend) — S
- Rewrite `src/lib/notifications/email.ts` to call Resend, keep the signature
  (zero caller changes); add optional `html?` for React Email later.
- Add `RESEND_API_KEY` + `EMAIL_FROM` to `src/lib/env.ts` (schema + `checkEnv`).
- Wire invites: capture `createInvite()` at `actions/invites.ts:67`, build link
  from `NEXT_PUBLIC_APP_URL` + `/invite/${token}`, send, persist to `notification`.
- Fill the two auth hooks (`auth.ts:85-97`): password reset + verification.
- Extend `notification.kind` (`invite`, `password_reset`, `proposal`) as an outbox.
- Watch: auth emails may have no `agencyId` (NOT NULL on `notification`).

## 3. Stripe SaaS billing (vendor → agencies) — M
- Migration `0009`: add to `agency` — `stripeCustomerId`, `stripeSubscriptionId`,
  `subscriptionStatus`, `priceId`, `currentPeriodEnd`, `trialEndsAt`.
- Gate in `requireAgencyUser` (`permissions.ts:136-144`) — already checks
  `agency.status`; add subscription-state block (`past_due`/`canceled`).
- `createAgency` (`actions/platform.ts:74`) creates Stripe customer + trial sub.
- New route `src/app/api/stripe/webhook/route.ts` (POST, raw `req.text()` body).
- Add the official `stripe` npm SDK (subscriptions + signature verification).
- Env: `STRIPE_WEBHOOK_SECRET` + price IDs. Surface status on platform detail page.
- Stripe Connect (traveler payments) = deferred to Phase 1.5, separate module on
  the `payment`/`booking` plane.

## 4. PDF proposals — M
- Today = HTML + `window.print()`. Add real renderer: Puppeteer +
  `@sparticuz/chromium` on Vercel serverless, store via `@vercel/blob`
  (`src/lib/storage.ts`). Alt: `react-pdf`. Fix the broken proposal link.

## 5. E-signature acceptance — M (greenfield)
- Add to `product`: `shareToken` (unique), `acceptedAt`, `declinedAt`,
  `signerName`, `signerEmail`, `signatureData`, `signerIp`, `signerUserAgent`.
- Public token route mirroring `/i/[token]`: `generateProposalLink` (copy
  `generateShareLink` `bookings.ts:383`), new unauth `/p/[token]`.
- New unauth `acceptProposalByToken` (first token-authed write) → set signature,
  `product.status=accepted`, `opportunity.stage=won`, send confirmation email.

## 6. Hotelbeds (hotels) + Amadeus (flights) — M
- New `src/lib/suppliers/hotelbeds.ts` mirroring `amadeus.ts` (Api-key + SHA-256).
- Split `getSupplier()` (`suppliers/index.ts:20`) into `getFlightSupplier()` /
  `getHotelSupplier()`; update `safeSearch` + call sites (`actions/search.ts`,
  `api/chat/route.ts`).
- Add `rateKey` to `HotelOffer`; persist supplier offers into `bookingItem.details`
  (AI `createBooking` currently drops them; `confirmItemBooking` expects them).
- Add `HOTELBEDS_API_KEY`/`HOTELBEDS_SECRET` to `env.ts`.

## Effort

| # | Feature | Effort | Status |
|---|---|---|---|
| 1 | DB split (code parts) | S | ✅ done — Neon branch is a manual step |
| 2 | Email (Resend) | S | ✅ done |
| 3 | Stripe SaaS billing | M | ✅ done (subscriptions); Connect deferred |
| 4 | PDF proposals | M | ✅ done (@react-pdf, server-rendered) |
| 5 | E-signature | M | ✅ done (public token + sign + audit) |
| 6 | Hotelbeds + flights | M | ✅ done (per-vertical providers + rateKey) |

## Manual setup required (you)

- **Neon dev branch:** create a separate Neon branch/database for local dev; put
  its URL in local `.env`, keep prod `POSTGRES_URL` only in Vercel env. Set
  `PROTECTED_DB_HOSTS=<prod-neon-host>` in prod env so destructive scripts refuse
  to touch it (override with `ALLOW_PROD=1`).
- **Resend:** add `RESEND_API_KEY` + `EMAIL_FROM` (verified domain) to `.env` and
  Vercel. Without them, emails log to console (status `logged`).
- **Stripe billing:** add `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` (the SaaS plan
  price), and `STRIPE_WEBHOOK_SECRET` to `.env` and Vercel. Register the webhook
  endpoint `POST /api/stripe/webhook` in the Stripe dashboard, subscribing to
  `customer.subscription.{created,updated,deleted}`. Enable the Billing Portal.
- **Suppliers:** add `AMADEUS_CLIENT_ID`/`AMADEUS_CLIENT_SECRET` (flights) and
  `HOTELBEDS_API_KEY`/`HOTELBEDS_SECRET` (hotels); optional `*_HOSTNAME=production`.
  Without them, search falls back to sample data. Hotelbeds keys availability by
  its own destination codes — pass a resolved `cityCode` for live hotel search
  (city name works against the mock).

## Known follow-ups (not blocking Phase 1)

- AI `createBooking` tool (`api/chat/route.ts`) still doesn't persist the
  supplier offer into `bookingItem.details`, so AI-built items can't be auto-booked
  by `confirmItemBooking`. The human search→"Add to booking" flow does persist it.
- Hotelbeds destination-code resolution (content API) for city-name → code.
