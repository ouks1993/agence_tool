# Operations — deployment & demo accounts

← Back to [Atlas index](../../atlas.md)

## Deployment

- **Vercel** project `atlasproject/agence_tool`, connected to GitHub.
- **Auto-deploy:** `git push origin main` → builds & ships production.
- **Manual:** `npx vercel deploy --prod --yes`.
- `vercel.json` → `buildCommand: npm run build:ci`; `.npmrc` →
  `legacy-peer-deps=true`.
- **Vercel env:** `POSTGRES_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`,
  `BETTER_AUTH_URL` (fixes `INVALID_ORIGIN` on the deployed domain).

> ⚠️ **Prod and local dev share one Neon database.** Split prod onto its own Neon
> branch before onboarding real customers.

---

## Demo accounts

Throwaway accounts on the **Demo Agency** for demos. All on the live site.

| Role | Email | Password |
|---|---|---|
| Platform admin (vendor) | `ouksili.abdelmalek@gmail.com` | `Atlas!2026` |
| Manager | `yasmine@agence.test` | `Agency!2026` |
| Finance | `finance@demo.test` | `Finance!2026` |
| Support | `support@demo.test` | `Support!2026` |
| Agent | `karim@demo.test` | `Agent!2026` |
| Agent | `lina@demo.test` | `Agent!2026` |
| Agent | `omar@demo.test` | `Agent!2026` |

> 🔒 **DEMO CREDENTIALS ONLY** — these are throwaway accounts for the demo
> agency. **Rotate or delete them before any real production use**, and do not
> reuse these passwords. Reset/recreate via the scripts above.

**Suggested demo flow:** sign in as the vendor → `/platform` → create an agency
(or *View as* Demo Agency) → manager dashboard charts → switch logins to show
finance / support / agent views → Settings → switch to Français or العربية (RTL).
