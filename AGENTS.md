# CRITICAL RULES - MUST FOLLOW

## RESPONSES

- Keep responses concise and to the point - unless the user asks otherwise

## PLANNING MODE

- Always ask clarifying questions
- Never assume design, tech stack or features
- Use deep-dive sub-agents to assist with research
- Use deep-dive sub-agents to review the different aspects of your plan before presenting to the user

## CHANGE / EDIT MODE

- Never implement features yourself when possible - use sub-agents!
- Identify changes from the plan that can be implemented in parallel, and use sub-agents to implement the features efficiently
- When using sub-agents to implement features, act as a coordinator only
- Use the best model for the task - premium models for complex tasks (like coding) and mid-tier models for simpler tasks, like documentation
- After completing features (large or small), always run commands like lint, type check and next build to check code quality

## DATABASE SCHEMA CHANGES

- Whenever you make changes to the database schema, ALWAYS run the drizzle generate and migrate commands
- NEVER run drizzle push!
- For all ID columns NOT related to BetterAuth, use UUID for the ID columns and be randomly generated

## TESTING

- Use any testing tools, libraries available to the project for testing your changes
- Never assume your changes simply work, always test!
- If the project does not have any testing tools, scripts, MCP tools, skills, etc. available for testing, ask the user whether testing should be skipped.

## UI DESIGN

- Always follow the UI design system when creating or reviewing components or pages.
- Design System: @DESIGN.md

## FEATURE FILTER RULE

Before any feature is committed to the roadmap, it must satisfy at least one of:

1. **Reduces time to booking** — the agent completes the booking workflow faster
2. **Increases booking conversion** — more proposals become bookings, more searches become proposals
3. **Increases agency retention** — the agency becomes more operationally dependent on Atlas

If a proposed feature cannot clearly satisfy at least one criterion, it does not move forward.
Apply this rule before design, before estimation, before any engineering discussion.

Examples:
- Supplier booking ✅ (reduces time to booking + increases conversion)
- Client portal depth ✅ (increases conversion + increases retention)
- Marketing campaigns module ❌ (does not directly satisfy any criterion — do not build)
- WhatsApp messaging platform ❌ (build as output channel/integration, not a messaging system)
- Accounting workflows (invoice generation + export) ✅ (reduces time to booking)
- Full GL accounting module ❌ (does not satisfy any criterion — partner instead)

## PRE-COMMIT DOCUMENTATION RULE

Before every commit, you MUST:

1. **Review all modified files** — understand the full scope of what changed.
2. **Update affected documentation** — if the change touches behaviour, architecture,
   business rules, APIs, DB schema, UI patterns, or config, update the relevant
   file(s) in `docs/`, `atlas.md`, `DESIGN.md`, or `AGENTS.md` to stay in sync.
3. **Ensure no contradictions** — the docs must not describe something that the code
   no longer does. If they conflict, fix the docs before committing.
4. **Record architectural/business decisions** — if the change introduces a new
   architectural pattern, a significant tech choice, or a business-rule change,
   create a record under `docs/decisions/` using the template at
   `docs/decisions/_template.md`.
5. **Summarize doc updates in the commit message** — include a "Docs:" line listing
   which documentation files were updated and why.

Example commit message footer:
```
Docs: updated docs/business-rules.md (new booking prerequisite),
      docs/decisions/0001-soft-delete-strategy.md (new decision record)
```
