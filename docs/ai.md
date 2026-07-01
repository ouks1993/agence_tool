# AI Features

Built on the **Vercel AI SDK (`ai` v5)**. **Google Gemini is the primary provider**
(`@ai-sdk/google`, `GEMINI_API_KEY`), with **OpenRouter** (`@openrouter/ai-sdk-provider`,
`OPENROUTER_API_KEY`) as the automatic fallback. All features degrade/no-op gracefully
when no provider key is set. See [api-integrations.md](api-integrations.md).

There are two surfaces:

- The **conversational assistant** at `/assistant`, backed by the streaming route
  `src/app/api/chat/route.ts` with agency-scoped tools.
- Four **inline AI actions** — server actions in `src/lib/actions/ai.ts` — embedded
  where the work happens (itinerary page, new-proposal form, booking communications,
  booking detail).

## Provider & models

**Gemini is tried first, OpenRouter second.** Both keys are optional in
`src/lib/env.ts`; set at least one. `env.ts` warns "No AI provider configured…" only
when *both* are missing. The two surfaces differ in *how* they fall back:

| Surface | Where | Primary → fallback | Model env (default) |
|---|---|---|---|
| Assistant chat (streaming) | `src/app/api/chat/route.ts` | **Static** — Gemini if `GEMINI_API_KEY` set, else OpenRouter (streams can't fall back mid-response) | `GEMINI_MODEL` (`gemini-2.5-flash`) / `OPENROUTER_MODEL` (`openai/gpt-5-mini`) |
| Inline actions | `src/lib/actions/ai.ts` | **Runtime chain** — every call runs through `withAiFallback()` over an ordered candidate list: primary Gemini → lighter Gemini models → OpenRouter. On *any* error it rolls to the next candidate | `GEMINI_MODEL` (`gemini-2.5-flash`) / `OPENROUTER_MODEL` (`openai/gpt-4.1-mini`) |

The runtime fallback exists chiefly for **Gemini's free tier**, which has real
rate/quota limits. Because each free-tier Gemini model has its **own** quota
bucket, `aiModels()` builds the candidate list as `GEMINI_MODEL` → the
`GEMINI_FALLBACK_CHAIN` (`gemini-2.5-flash` → `gemini-2.5-flash-lite`, deduped) →
OpenRouter (only if `OPENROUTER_API_KEY` is set).
`withAiFallback()` iterates it, so a throttled model rolls over to the next one —
staying on Gemini if possible, crossing to OpenRouter only as a last resort. If no
provider key is set at all, both surfaces error clearly ("No AI provider configured…").

### AI SDK primitives used

| Primitive | Import | Used by |
|---|---|---|
| `streamText` | `ai` | Assistant chat route (streamed, tool-calling) |
| `generateObject` | `ai` | `generateItinerary`, `buildQuote`, `checkVisa` (Zod-schema-constrained output) |
| `generateText` | `ai` | `draftEmail` (free-text, hand-parsed) |
| `useChat` | `@ai-sdk/react` | Assistant UI (`/assistant`) |
| `tool`, `convertToModelMessages`, `stepCountIs` | `ai` | Assistant tool loop |

Package versions (per `package.json`): `ai@^5.0.188`, `@ai-sdk/react@^2.0.190`,
`@ai-sdk/google@^2.0.77` (Gemini, must stay on the `2.x` line to match the
`@ai-sdk/provider@2` that `ai@5` uses — `@ai-sdk/google@4` pulls `provider@4` and is
incompatible), `@openrouter/ai-sdk-provider@^1.5.4`.

## AI must never

Hard guardrails for every AI feature. These extend the
[never rules](business-rules.md#never-rules-hard-constraints) to the AI surface:

- **Never invent prices** — quote only live supplier rates or stored values, never
  a guessed number.
- **Never invent bookings** — only create a booking when explicitly asked.
- **Never invent clients** — never fabricate a client record.
- **Never invent payments** — never record or imply a payment that didn't happen.
- **Never modify data without confirmation** — mutations are explicit and
  reviewable, not silent side effects of a chat reply.
- **Never hide errors** — surface failures to the user; don't paper over a failed
  tool call with a plausible answer.
- **Never perform destructive actions silently** — no deletes/overwrites without a
  clear, confirmed user action.

> **Current state:** all assistant tools are agency-scoped (via
> `resolveEffectiveAgencyId`, which honors platform-admin "view as" impersonation).
> Of them only `createBooking` mutates — it creates a **draft** booking (zero
> balance, unconfirmed), and the system prompt forbids inventing supplier
> confirmations or PNRs and restricts creation to explicit requests. Everything
> else is **read-only**:
>
> - **Sourcing:** `searchFlights`, `searchHotels` (live suppliers).
> - **CRM/ops read tools** (`src/lib/assistant/tools/{bookings,clients,sales,finance}.ts`,
>   each a `make<Domain>Tools({ agencyId })` factory spread into the route when an
>   agency is in scope): `findClients` + `getClientDetails` (profile, stats, history);
>   `listBookings` (filter by status/client/destination/date — answers "who
>   cancelled", "departing this week") + `getBookingDetails`; `listProposals` +
>   `pipelineOverview`; `bookingsSummary` + `financeOverview` + `commissionsOverview`
>   (all currency-safe, DZD headline). Every query is hard-scoped to `ctx.agencyId`.
>
> Gap: creation is intent-gated by the prompt, not yet behind a hard confirm step —
> the "modify without confirmation" guard is a convention, not an enforced gate.

## AI assistant (`/assistant`)

The chat UI (`src/app/(app)/assistant/page.tsx`) uses `useChat` from
`@ai-sdk/react`, renders assistant replies through `react-markdown`, and persists
the thread to `localStorage` (key `chat-messages`) — there is no server-side chat
history yet (the History button is disabled). The context rail seeds ready-made
prompts into the composer (quote / follow-up / visa / flight search) rather than
calling the inline actions directly.

### Route: `POST /api/chat`

`src/app/api/chat/route.ts` handles the request:

1. **Auth** — resolves the Better Auth session; returns 401 if absent.
2. **Tenant scope** — reads `agencyId` off the session user. It is `NULL` only for
   the platform super-admin, in which case the data tools return empty results
   rather than querying globally, so the assistant can never read across agencies.
3. **Input validation** — the body is parsed with a Zod schema
   (`chatRequestSchema`): at most 100 messages, each message text capped at 10,000
   chars. Message `role` is restricted to `user`/`assistant` — `role:"system"` is
   deliberately rejected so a caller cannot inject their own system prompt (and
   through it drive tool calls).
4. **Stream** — `streamText` is called with the server-controlled system prompt,
   `convertToModelMessages(messages)`, `stopWhen: stepCountIs(6)` (max 6 tool/model
   steps), and the tool set below. The response is returned via
   `toUIMessageStreamResponse()`. Any setup/streaming throw is converted to a
   structured JSON error (HTTP 502).

The system prompt is built by `SYSTEM_PROMPT(today, agentName)` in the same file. It
addresses the agent by name, sets today's date and EUR as the default currency,
tells the model to infer IATA codes but state them, to disclose when figures come
from sample data, and — as the hard rule — **never to invent supplier confirmations
or PNRs and to create a booking only when explicitly asked**.

### Assistant tools

All five tools are defined inline in the route and are agency-scoped wrappers over
existing server actions / suppliers, so the AI cannot bypass
[security.md](security.md) tenant isolation. Tool inputs are Zod-validated.

| Tool | Kind | What it does | Scope / notes |
|---|---|---|---|
| `searchFlights` | read | Flight search by IATA codes + dates via `safeSearch(getFlightSupplier, …)`; returns up to 5 cheapest offers, currency forced to EUR | Returns `source` + `degraded`; `degraded:true` means mock/sample prices, forwarded so the assistant can disclose it |
| `searchHotels` | read | Hotel search by city + dates via `safeSearch(getHotelSupplier, …)`; returns up to 6 offers with star ratings, EUR | Same `source`/`degraded` disclosure |
| `findClients` | read | Looks up clients in the agency CRM by name (or lists recent) | Always ANDs `eq(client.agencyId, agencyId)`; platform admin (no agency) gets `[]`; limit 10 |
| `bookingsSummary` | read | Counts bookings by status and sums active (non-cancelled) value in EUR | Filtered to `booking.agencyId`; platform admin gets an empty summary |
| `createBooking` | **write** | Creates a **draft** booking from items (flight/hotel/transfer/excursion/insurance/fee/other) + optional travellers; returns a `/bookings/{id}` link | Only mutating tool. Rejects when no agency context; a supplied `clientId` is verified to belong to the agency before use; per-row traveller/item failures are collected and reported (`failedTravellers`/`failedItems`), not swallowed |

`createBooking` delegates to `createBooking`, `addTraveller`, and `addBookingItem`
from `src/lib/actions/bookings.ts`. Flight/hotel search goes through
`safeSearch` in `src/lib/suppliers` (real provider first, mock fallback tagged
`degraded:true`) — see [api-integrations.md](api-integrations.md).

## Inline features

Embedded where the work happens, not in a separate AI section. All four are server
actions in `src/lib/actions/ai.ts`, each guarded by `requireAgencyUser()` (from
`src/lib/permissions`) and scoped to `user.agencyId`. On failure they return
`{ ok: false, error }` with the message
"AI generation failed. Check that OPENROUTER_API_KEY is set."

| Feature | Action | SDK call | Trigger UI | Consumed at |
|---|---|---|---|---|
| Itinerary generation | `generateItinerary(bookingId)` | `generateObject` | `GenerateItineraryButton` | `/bookings/[id]/itinerary` |
| Quote builder | `buildQuote(brief, currency, paxCount)` | `generateObject` | `AiQuoteBuilder` | new-proposal form |
| Email drafting | `draftEmail(bookingId, kind, customInstruction?)` | `generateText` | `AiEmailDraftButton` | booking communications panel |
| Visa assistant | `checkVisa(bookingId)` | `generateObject` | `VisaAssistant` | `/bookings/[id]` |

### AI itinerary generation

`generateItinerary` loads the agency-scoped booking with its items (ordered by
`sortOrder`), refuses if there are no items, and asks the model — via
`generateObject` constrained to `itinerarySchema` (`days[]` of
`{ dayIndex, title, notes }`) — for a concise day-by-day plan referencing the actual
items. Each returned day is **upserted** into `booking_day` rows (existing rows with
the same `dayIndex` have their title/notes overwritten). It then revalidates
`/bookings/{id}/itinerary` and returns `{ dayCount }`. The saved rows render on the
booking's itinerary page and on the public shareable itinerary at `/i/[token]` (via
`booking.shareToken` and `buildItinerary` in `src/lib/itinerary.ts`).

- **Trigger:** `src/components/bookings/generate-itinerary-button.tsx`, mounted in
  `src/app/(app)/bookings/[id]/itinerary/page.tsx`.

### AI quote builder

`buildQuote` takes a natural-language brief plus currency and traveller count and
returns structured proposal line items via `generateObject` constrained to
`quoteSchema` (`title`, optional `destination`, and `items[]` of
`type`/`title`/`supplier`/`quantity`/`unitCost`/`description`, where `type` is one of
`flight`/`hotel`/`activity`/`transfer`/`insurance`/`other`). The prompt instructs the
model to use realistic market estimates and per-person quantities. **It does not
persist anything** — the result pre-fills the new-proposal form for the agent to
review; line items are added after the proposal is created.

- **Trigger:** `src/components/products/ai-quote-builder.tsx`, wrapped by
  `src/components/products/new-product-with-ai.tsx` (which applies the quote into the
  form via `applyQuote`).

### AI email drafting

`draftEmail` loads the agency-scoped booking (with client, items, travellers) and
generates a client email with `generateText`. The `kind` argument selects the brief:
`confirmation`, `voucher`, `followup`, or `custom` (the latter using
`customInstruction`). The model is asked to emit `SUBJECT: …` then `---` then the
body; the action splits on `\n---\n`, strips the `SUBJECT:` prefix, and returns
`{ subject, body }` — returning a parse error if either half is empty. It writes no
data; the accepted draft is lifted into the compose form.

- **Trigger:** `src/components/bookings/ai-email-draft-button.tsx`, mounted in
  `src/components/bookings/communications-manager.tsx`.

### AI visa assistant

`checkVisa` loads the agency-scoped booking with travellers, requires a booking
`destination` and at least one traveller `nationality`, then de-duplicates the
nationalities and asks the model — via `generateObject` constrained to a
`{ destination, requirements[], disclaimer }` schema — for a per-nationality visa
summary plus a disclaimer to verify with official sources. Results are **based on the
model's training data**, not a live visa database, and are read-only.

- **Trigger:** `src/components/bookings/visa-assistant.tsx`, mounted in
  `src/app/(app)/bookings/[id]/page.tsx`.

## Implementation

- Assistant route: `src/app/api/chat/route.ts` (streaming, tools, system prompt).
- Assistant UI: `src/app/(app)/assistant/page.tsx` (+ `src/components/assistant/*`).
- Inline server actions: `src/lib/actions/ai.ts`.
- Itinerary rendering helpers: `src/lib/itinerary.ts`.
- Supplier search used by the assistant: `src/lib/suppliers` (`safeSearch`,
  `getFlightSupplier`, `getHotelSupplier`).
- Env schema: `src/lib/env.ts` (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`).
- The assistant's tool definitions and every inline action are agency-scoped
  (session `agencyId` / `requireAgencyUser`), so AI cannot bypass
  [security.md](security.md) tenant isolation.
