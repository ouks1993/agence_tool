# Server Actions Reference

All server-side mutations are Next.js Server Actions under `src/lib/actions/`.
Every action:

1. Calls `requireAgencyUser()` to authenticate + get `(userId, agencyId)`.
2. Validates input with Zod (most actions; see gap tracker in [roadmap.md](roadmap.md)).
3. Returns `ActionResult<T>` — `{ success: true; data: T }` or `{ success: false; error: string }`.

```typescript
type ActionResult<T = void> =
  | { success: true;  data: T }
  | { success: false; error: string }
```

---

## bookings.ts

The largest action file (≈1000 lines). Orchestrates the full booking lifecycle.

### `createBooking(input)`
Creates a new booking file.

**Input:** `{ clientId, destination?, departDate?, returnDate?, currency?, notes? }`
**Guards:** client must belong to the agency (tenant isolation).
**Side effects:** auto-generates a human reference (`BKG-NNN`).

### `updateBooking(bookingId, input)`
Updates booking header fields (destination, dates, currency, notes, etc.).

**Guards:** booking must belong to the agency.

### `deleteBooking(bookingId)`
Hard-deletes a booking and all its children.

**Guards:** `canDeleteRecords(role)` (admin/manager only).
**Note:** soft delete is not yet implemented — see [database.md](database.md) gap tracker.

### `advanceStatus(bookingId)`
Advances the booking to the next lifecycle state.

**Lifecycle:** `draft → awaiting_payment → confirmed → ticketed → completed → cancelled`

**Prerequisites enforced:**
- `confirmed`: trip items present AND zero outstanding balance.
- `ticketed`: trip items present.

**Side effects:**
- On `confirmed` or `ticketed`: `autoGenerateCommissions(bookingId, agencyId)` (idempotent).
- On `ticketed`: fires `confirmItemBooking` for all unconfirmed trip items (flights, hotels, transfers) → calls `serviceBookFlight` / `serviceBookHotel` via the provider registry.

### `bookItem(bookingItemId)`
Attempts to confirm a single booking item with the supplier.

**Side effects:** calls `serviceBookFlight` or `serviceBookHotel` in `booking-service.ts`.
Returns `{ confirmed: boolean; confirmationNumber: string; reason?: string }`.

### `addTraveller(bookingId, input)` / `updateTraveller(travellerId, input)` / `deleteTraveller(travellerId)`
CRUD for `booking_traveller`. Input includes personal details (name, title, gender, passport, DOB, nationality) plus `email`/`phone` (required for the lead passenger by supplier APIs).

### `addBookingItem(bookingId, input)` / `updateBookingItem(itemId, input)` / `deleteBookingItem(itemId)`
CRUD for `booking_item`. `type` must be a `BOOKING_ITEM_TYPES` code.

### `updateItemOrder(bookingId, orderedIds)`
Reorders booking items by updating `sort_order`.

### `assignDay(itemId, dayIndex)`
Assigns a `booking_item` to a specific itinerary day.

### `updateBookingDay(bookingId, dayIndex, input)`
Upserts a `booking_day` title/notes row for a given day index.

### `shareBooking(bookingId)` / `unshareBooking(bookingId)`
Generates or clears the `booking.shareToken` (itinerary public link `/i/[token]`).

### `generateVoucher(bookingId)` / `generateInvoice(bookingId)`
Server-rendered PDF generation. Guards: booking must have trip services.
Sends the PDF link via `notification` log.

### `sendConfirmationEmail(bookingId)`
Sends a booking confirmation email to the client via Resend.
Falls back to logging when Resend is unconfigured.

---

## clients.ts

### `createClient(input)`
Creates a client record. `type` defaults to `"individual"`.
Validates country against the ISO reference list.

### `updateClient(clientId, input)`
Updates client fields. Validates country, source, and industry codes.

### `deleteClient(clientId)`
Hard-deletes the client and all descendant records.
**Guards:** `canDeleteRecords(role)`.

### `addContact(clientId, input)` / `updateContact(contactId, input)` / `deleteContact(contactId)`
CRUD for `client_contact`.

### `convertToClient(clientId)`
Flips a lead (`status = "lead"`) to an active client.

---

## opportunities.ts

### `createOpportunity(input)`
Creates an opportunity. `stage` defaults to `"lead"`.

### `updateOpportunity(opportunityId, input)`
Updates opportunity fields including stage, value, and travel details.

### `deleteOpportunity(opportunityId)`
**Guards:** `canDeleteRecords(role)`.

### `advanceOpportunityStage(opportunityId)`
Advances through: `lead → qualified → proposal → booked → won`.
`won` is terminal; `lost` can be set via `updateOpportunity`.

---

## products.ts (proposals)

### `createProduct(input)`
Creates a proposal draft. Auto-generates `PRD-NNN` reference.

### `updateProduct(productId, input)`
Updates proposal fields including markup and dates.

### `deleteProduct(productId)`
**Guards:** `canDeleteRecords(role)`.

### `addProductItem(productId, input)` / `updateProductItem(itemId, input)` / `deleteProductItem(itemId)`
CRUD for `product_item` line items.

### `sendProposal(productId)`
Sets `status = "sent"` and generates a `shareToken` for the public link.
Sends a notification email to the client.

### `shareProposal(productId)` / `unshareProposal(productId)`
Generates or clears the `product.shareToken`.

### `convertProposalToBooking(productId)`
One-click conversion: creates a `booking` from an accepted `product`, copying
client, dates, and line items. Flips the linked opportunity to `"won"`.

---

## proposals-public.ts

Actions callable from the **public proposal page** (`/p/[token]`) — no auth.

### `acceptProposal(token, input)`
- Validates token; finds product.
- Sets `acceptedAt`, stamps signer name/email/IP/UA and `signatureData`.
- If `opportunityId` is linked, advances opportunity to `"won"`.

### `declineProposal(token)`
Sets `declinedAt`.

---

## payments.ts

### `createPayment(bookingId, input)`
Records a payment against a booking. `kind` must be `PAYMENT_KINDS` code.
Re-calculates outstanding balance.

### `deletePayment(paymentId)`
**Guards:** `canManagePayments(role)`.

### `createStripeCheckout(bookingId, amount)`
Creates a Stripe Checkout Session (Connect: destination charge to agency).
Returns `{ checkoutUrl }`.

---

## commissions.ts

### `autoGenerateCommissions(bookingId, agencyId)`
Idempotent — safe to call multiple times. Generates two commission rows per
bookable item: `supplier_to_agency` (from the supplier contract) and
`agency_to_agent` (from `user.commissionRatePercent`).
Called automatically by `advanceStatus` on `confirmed` / `ticketed`.

### `updateCommission(commissionId, input)`
Adjusts `status` (`confirmed → paid`, etc.) or `amount` / `notes`.

### `deleteCommission(commissionId)`
**Guards:** `canViewFinance(role)`.

---

## suppliers.ts

### `createSupplier(input)` / `updateSupplier(supplierId, input)` / `deleteSupplier(supplierId)`
CRUD for the managed supplier directory.

### `createSupplierContract(supplierId, input)` / `updateSupplierContract(contractId, input)` / `deleteSupplierContract(contractId)`
CRUD for supplier contracts.

### `createSupplierRate(contractId, input)` / `updateSupplierRate(rateId, input)` / `deleteSupplierRate(rateId)`
CRUD for per-product rates within a contract.

### `uploadContractFile(contractId, formData)`
Uploads a PDF contract to Vercel Blob and saves the URL.

---

## notifications.ts

### `sendNotification(bookingId, input)`
Sends an email/SMS/WhatsApp/push notification to a recipient.
Logs to `notification` table regardless of delivery status.

---

## invites.ts

### `inviteTeamMember(input)`
Creates an `agency_invite` row with a signed, expiring token.
Sends an invitation email via Resend (or logs + returns the link when unconfigured).

### `revokeInvite(inviteId)`
Marks the invite `status = "expired"`.

---

## team.ts

### `updateTeamMember(userId, input)`
Updates `role`, `active`, `commissionRatePercent`. Role changes are gated:
only an admin can assign/change the `admin` role (`canAssignAdmin(role)`).

### `deactivateTeamMember(userId)`
Sets `active = false`.

---

## settings.ts

### `updateAgencySettings(input)`
Updates agency `name`, `slug`.

### `updateUserProfile(input)`
Updates the current user's `name`, `locale`.

---

## onboarding.ts

### `dismissOnboarding()`
Sets `agency.onboardingDismissedAt` to close the getting-started card.

---

## search.ts

### `searchFlights(params)` / `searchHotels(params)`
Calls `safeSearch()` from `src/lib/suppliers/index.ts`. Returns offers
or mock data on provider failure. No mutation; safe to call from Server
Components or actions.

---

## ai.ts

### `generateItinerary(bookingId, prompt)`
Calls OpenRouter (streamed) to generate a day-by-day itinerary.
Returns a `ReadableStream` — consumed by the assistant UI.

### `generateQuote(opportunityId, prompt)`
AI-assisted quote: generates product items + summary text.

### `draftEmail(context, prompt)`
Drafts a client communication email. Output is shown in a preview step before sending.

### `visaAssistant(destination, nationality)`
Returns visa requirement guidance. Advisory only — never authoritative.

---

## billing.ts

### `createCheckoutSession()`
Starts a Stripe subscription Checkout for an agency. Redirect to Stripe.

### `createBillingPortalSession()`
Opens the Stripe Billing Portal for subscription management.

---

## platform.ts

Vendor-only (requires `is_platform_admin = true`).

### `listAgencies()` / `getAgencyStats(agencyId)`
Vendor console: list all agencies with billing status and usage stats.

### `suspendAgency(agencyId)` / `activateAgency(agencyId)`
Toggle `agency.status` (`"suspended" \| "active"`).
Suspended agencies are locked out via `requireAgencyUser`.

---

## portal-*.ts

Actions for the **client portal** (`/portal/...`). Authenticated via
`portal_session.token` in an httpOnly cookie — entirely separate from
Better Auth.

### `portal-invite.ts`
#### `sendPortalInvite(clientId)`
Generates a magic-link token (`portal_session`), emails it to the client,
and returns the URL (so the agent can copy it when email is unconfigured).

### `portal-payments.ts`
#### `createPortalCheckout(bookingId, amount)`
Stripe Connect destination charge — same backend as `payments.ts`, but
verifies the caller is the scoped client (via `portal_session.clientId`).

### `portal-proposals.ts`
#### `portalAcceptProposal(productId, input)` / `portalDeclineProposal(productId)`
In-portal e-sign flow. Same logic as `proposals-public.ts` but verifies the
caller is the client the proposal belongs to.
