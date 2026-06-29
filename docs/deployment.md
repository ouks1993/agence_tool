# Deployment

## Vercel

- Project `atlasproject/agence_tool`, connected to GitHub.
- **Auto-deploy:** `git push origin main` → builds & ships production.
- **Manual:** `npx vercel deploy --prod --yes`.
- `vercel.json` → `buildCommand: npm run db:migrate && npm run build:ci`; `.npmrc` →
  `legacy-peer-deps=true`.
- Migrations run automatically on every deploy — no manual step needed for schema changes.

## Vercel environment

`POSTGRES_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL`,
`PROTECTED_DB_HOSTS=ep-misty-thunder-aixz34vy` (plus integration keys as needed —
see [api-integrations.md](api-integrations.md)).

## Migrations on prod

Migrations now run automatically as part of every Vercel deploy (`npm run db:migrate` is prepended to the build command). No manual step required.

For one-off manual runs (e.g. emergency hotfix outside a deploy):

```bash
POSTGRES_URL=<prod-url> npx drizzle-kit migrate
```

Branches: dev `ep-dawn-voice-ai8d6q3o` · prod `ep-misty-thunder-aixz34vy`.
`PROTECTED_DB_HOSTS` makes destructive scripts refuse the prod DB unless
`ALLOW_PROD=1`. See [security.md](security.md) and
[database.md](database.md).

## Demo accounts

Throwaway accounts on the **Demo Agency**, all on the live site.

| Role | Email | Password |
|---|---|---|
| Platform admin (vendor) | `ouksili.abdelmalek@gmail.com` | `Atlas!2026` |
| Manager | `yasmine@agence.test` | `Agency!2026` |
| Finance | `finance@demo.test` | `Finance!2026` |
| Support | `support@demo.test` | `Support!2026` |
| Agent | `karim@demo.test` | `Agent!2026` |
| Agent | `lina@demo.test` | `Agent!2026` |
| Agent | `omar@demo.test` | `Agent!2026` |

> 🔒 **DEMO CREDENTIALS ONLY** — rotate or delete before any real production use.
> These live passwords are checked into the repo; treat as a known risk (see
> [security.md](security.md)).

**Suggested demo flow:** sign in as vendor → `/platform` → View as Demo Agency →
manager dashboard → switch to finance/support/agent views → Settings → switch to
Français or العربية.
