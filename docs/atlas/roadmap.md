# Roadmap & changelog

← Back to [Atlas index](../../atlas.md)

## Roadmap / open items

**Done — Phase 1 "sellable" + hotel module:** ✅ Email delivery (Resend) · ✅ Stripe
SaaS billing (subscriptions + webhook + gating) · ✅ DB-split safety (env validation
+ prod-guarded scripts) · ✅ PDF proposals · ✅ E-signature acceptance · ✅ Live
flights (Duffel: autocomplete, one-way/round-trip, flight codes, connecting airports)
· ✅ Live hotels (Hotelbeds: Booking.com-style search/results/details, dynamic
occupancy pricing, filters, add-to-proposal/booking) · ✅ Hotel content cache
(`hotel_content` table + `sync-hotel-content.ts` — real photos served quota-free).

**Phase 2 — open:**
1. **Provision dedicated prod Neon branch** — code-side guard is in place; branch creation is a manual ops step.
2. **Stripe Connect** — traveler payment collection (separate from SaaS billing; `payment` table already exists).
3. **Real supplier booking** — Duffel orders + Hotelbeds book API (currently search-only / provisional); persist confirmed offers into `bookingItem.details` and from the AI tool.
4. **Translate deeper pages** — bookings, clients, finance, support, platform (translation keys just need filling; i18n plumbing is ready).
5. **Cross-device locale** — sync `user.locale` → cookie on login so a fresh device inherits the user's saved language.
6. **Traveler portal** — end-customer login to view their own trips (greenfield; new user type + auth flow).

---

## Changelog

| Commit | Summary |
|---|---|
| `9e8fb4b` | Multi-tenant architecture + vendor platform console |
| `76e55b4` | `vercel.json` for deployment |
| `edc4133` | `legacy-peer-deps` for install (better-auth peer conflict) |
| `aa904d9` | Better Auth baseURL + trustedOrigins (fix INVALID_ORIGIN) |
| `471eed7` | `.vercelignore` (exclude scripts from builds) |
| `f982d2c` | "View as agency" impersonation |
| `1896596` | Per-role workspaces (Finance + Support) + role-based landing/nav |
| `63f1d68` | Analytics charts (dashboard + finance) |
| `7fea32e` | Re-runnable demo data seed |
| `a233d32` | View-as-user + i18n (EN/FR/AR + RTL) + Settings hub |
| `8d679f4` | DZD currency |
| `b67cfa0` | Phase 1: email (Resend), Stripe billing, e-sign, PDF, suppliers |
| `eb467d0` | Switch flights to Duffel (Amadeus self-service sunsetting) |
| `508472e` | One-way flight option + flight codes |
| `b7ffa6d` | Connecting airports for multi-stop flights |
| `78ceb59` | Airport autocomplete (Duffel Places) |
| `1a92e27` | Hotel details view with photos (Hotelbeds Content) |
| `b3b6d20` | Hotel destination autocomplete |
| `74e0938` | Booking-style hotel cards with photo thumbnails |
| `957079b` | Room type, hotel type, facilities, room photos + hotel filters |
| `8c1b24e` | Hotel module (`/hotels`): full search/results/details, dynamic occupancy pricing, proposal integration + Hotelbeds content cache |

Started from a single-agency tool; now a deployed multi-tenant, multilingual SaaS
with live travel sourcing, billing, and e-signature. Migrations: 12 (latest `0011`).
