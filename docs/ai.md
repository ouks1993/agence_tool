# AI Features

Built on the **Vercel AI SDK + OpenRouter** (`OPENROUTER_API_KEY`). All features
degrade/no-op gracefully when the key is unset. See
[api-integrations.md](api-integrations.md).

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

> **Current state:** all assistant tools are agency-scoped. Of them only
> `createBooking` mutates — it creates a **draft** booking (zero balance,
> unconfirmed), and the system prompt forbids inventing supplier confirmations or
> PNRs and restricts creation to explicit requests. Everything else
> (`searchFlights`, `searchHotels`, `findClients`, `bookingsSummary`) is read-only.
> Gap: creation is intent-gated by the prompt, not yet behind a hard confirm step —
> the "modify without confirmation" guard is a convention, not an enforced gate.

## AI assistant (`/assistant`)

Chat backed by `api/chat` with **agency-scoped tools**: find clients, bookings
summary, create booking, search flights/hotels. Tools respect tenant scoping like
every other action.

## Inline features

Embedded where the work happens, not in a separate AI section:

- **AI itinerary generation** — one-click generation from booking items; saves to
  `booking_day` rows. Shareable via `/i/[token]`.
- **AI quote builder** — natural-language brief → structured proposal line items,
  pre-filled in the new-proposal form.
- **AI email drafting** — generate subject + body for confirmation, voucher,
  follow-up, or custom emails from the booking messages panel.
- **AI visa assistant** — per-nationality visa requirement summary from traveller
  passport nationalities + booking destination.

## Implementation

- Server actions in `src/lib/actions/ai.ts`.
- Itinerary helpers in `src/lib/itinerary.ts`.
- The assistant's tool definitions are agency-scoped wrappers over existing server
  actions, so AI cannot bypass [security.md](security.md) tenant isolation.
