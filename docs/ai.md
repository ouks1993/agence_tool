# AI Features

Built on the **Vercel AI SDK + OpenRouter** (`OPENROUTER_API_KEY`). All features
degrade/no-op gracefully when the key is unset. See
[api-integrations.md](api-integrations.md).

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
