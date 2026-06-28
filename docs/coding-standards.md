# Coding Standards

> **Source of truth:** [`AGENTS.md`](../AGENTS.md) (aliased by `CLAUDE.md`) holds
> the enforced working conventions. This doc summarizes and points there — it does
> not restate or override it.

## Working conventions (from AGENTS.md)

- **Responses** — keep concise and to the point unless asked otherwise.
- **Planning** — always ask clarifying questions; never assume design, stack or
  features; use deep-dive sub-agents for research and to review plans.
- **Change/edit mode** — prefer sub-agents to implement features; act as a
  coordinator; parallelize independent work; use premium models for complex tasks
  (coding) and mid-tier for simpler ones (documentation).
- **Quality gates** — after completing features, run lint, type check and
  `next build` (`npm run check`, `npm run build:ci`). See
  [development-guide.md](development-guide.md).
- **Testing** — use available testing tools; never assume changes work; if no
  tooling exists for a change, ask whether to skip.

## Engineering rules

Hard rules for how code is written. Status reflects the current codebase
(✅ holds · 🟡 partial).

| Rule | Status | Notes |
|---|---|---|
| **Never duplicate logic** | 🟡 | Shared helpers in `src/lib` (`queries`, `analytics`, `domain`); enforce by review. |
| **Always use server actions** | ✅ | 20/21 files in `src/lib/actions` are `"use server"`; mutations go through them. |
| **Always validate input** | 🟡 | Validated where it matters, not universally. |
| **Always use Zod** | 🟡 | Zod v4 present, used in ~13 files; not every action yet. |
| **No business logic inside components** | 🟡 | Logic lives in actions/lib; enforce by review. |
| **No direct SQL in UI** | ✅ | Pages call Drizzle queries server-side / via actions, not raw SQL in client components. |
| **Every action logs activity** | 🟡 | `logActivity` in ~11/21 action files — not yet every mutation (see [security.md](security.md#security-controls)). |
| **Every mutation is tenant scoped** | ✅ | All actions go through `requireAgencyUser()` → `agencyId` scope (see [business-rules.md](business-rules.md#never-rules-hard-constraints)). |

> The 🟡 rows (universal Zod validation, universal activity logging) are in the
> [spec-vs-reality gap tracker](roadmap.md#spec-vs-reality-gap-tracker).

## Database changes

- After any schema change, run **drizzle generate + migrate**. **Never**
  `db:push`. Workflow detail in [database.md](database.md).
- All ID columns **not** related to Better Auth use **UUIDs**, randomly generated.

## UI

- Follow the design system in [`DESIGN.md`](../DESIGN.md) when creating or
  reviewing components/pages. See [ui-ux.md](ui-ux.md).
