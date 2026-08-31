# Command deployment

This document describes the current deployment topology. The v3 living plan
governs future migration work; this file records how the repository deploys
today.

## Topology

- **Frontend:** static React 19 + Vite PWA hosted by Vercel at
  `https://command-beta-flax.vercel.app/`.
- **Frontend release trigger:** Vercel's Git integration builds `main`. There is
  no GitHub Pages deployment workflow.
- **Backend:** Supabase Auth, Postgres with RLS, and two Edge Functions:
  `google-calendar` and `command-mcp`.
- **Backend release trigger:** the manually dispatched `Deploy Supabase`
  workflow in `.github/workflows/deploy-supabase.yml`.
- **Verification:** `.github/workflows/ci.yml` runs for pushes to `main` and pull
  requests. CI verifies the build, unit tests, mobile WebKit E2E tests, and local
  pgTAP database tests; it does not deploy.

The app retains hash routes. Vercel therefore needs no SPA rewrite for current
deep links, and existing `/#/...` bookmarks remain valid.

## Frontend configuration and release

Vercel must provide these build-time values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Both values are publishable browser configuration. Do not place a service-role
key, Google client secret, token-encryption key, or database password in Vercel
browser variables.

Before merging a frontend release, run:

```bash
npm test
npx tsc -b
npm run build
```

Merging or pushing to `main` lets the linked Vercel project perform the frontend
build and deployment. The old GitHub Pages action must not be restored unless a
new ADR changes the hosting decision.

## Backend configuration and release

The `production` GitHub environment supplies the manual deployment workflow
with:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_ID`

Supabase Edge Function secrets supply:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_TOKEN_KEY`
- `APP_ORIGIN` — the Vercel application origin

Supabase injects its own URL, publishable key, and service-role key into the
function runtime. None of the secrets above belongs in the repository or a
browser build.

The manual workflow performs these steps in order:

1. Link the configured Supabase project.
2. Apply pending append-only migrations with `supabase db push`.
3. Enable the Supabase OAuth server and dynamic client registration for MCP.
4. Deploy `google-calendar --no-verify-jwt`.
5. Deploy `command-mcp --no-verify-jwt`.

The functions deliberately validate requests themselves. Calendar must accept
the unauthenticated Google OAuth callback, which is protected by one-time state
and PKCE; all other Calendar actions validate the user's bearer token. MCP
verifies its OAuth bearer token before rate limiting and dispatching tools.

Do not run the production workflow merely to verify a code change. Migration
application, function deployment, and production smoke tests require an
explicit release action.
