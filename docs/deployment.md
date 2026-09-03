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
  requests. CI verifies the build, unit tests, Chromium E2E tests, and local
  pgTAP database tests; it does not deploy.

The app retains hash routes. Vercel therefore needs no SPA rewrite for current
deep links, and existing `/#/...` bookmarks remain valid.

### Current Phase 8 recovery pin

The public alias currently points to the exact Phase 4 deployment
`dpl_5kno5iFZBxZh7ArWRV55bQMqZAwH` from commit `e2d5d15`. The first v3 frontend
candidate from `ad56848` reached Vercel only after the production export,
migrations, backfill, and function gates passed, but it failed owner visual
acceptance before the first v3 canonical user write. The alias was therefore
restored to Phase 4 while the accepted Gazette v12 UI is rebuilt on the local
`command-v3` branch.

Production Postgres now has additive migrations `0013`–`0037` and the verified
idempotent canonical backfill. Both v3 Edge Functions are deployed, and the
legacy tables remain untouched. This is a compatible pre-write recovery state:
do not repeat the migrations/backfill, push the local correction, promote a
Vercel candidate, move the alias, or perform the first v3 write without the
remaining Phase 8 gates and explicit release authorization. Keep MCP clients
idle until the accepted frontend is public and smoke-tested.

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

The manual workflow has two deliberately separate stages, both pinned to an
explicit full release SHA:

1. `migrations` links the configured project, previews pending append-only
   migrations, and applies them with `supabase db push`.
2. The operator runs the private, transactional backfill/verification gate.
3. `functions` enables the Supabase OAuth server and dynamic client registration
   for MCP, then deploys `google-calendar --no-verify-jwt` and
   `command-mcp --no-verify-jwt`.

The split prevents function deployment from racing ahead of production data
verification. The exact export, maintenance, migration, backfill, release,
smoke-test, and fix-forward gates are in
[`phase8-cutover.md`](phase8-cutover.md). That runbook requires separate explicit
production-cutover authorization; documenting it does not start Phase 8.

The functions deliberately validate requests themselves. Calendar must accept
the unauthenticated Google OAuth callback, which is protected by one-time state
and PKCE; all other Calendar actions validate the user's bearer token. MCP
verifies its OAuth bearer token before rate limiting and dispatching tools.
The MCP resource advertises only the supported `email` OAuth identity scope.
Command tool permissions are separate owner/client rows in
`mcp_client_permissions`: registry read (`command:types:read`), bounded
canonical reads (`command:data:read`), approval-gated proposal creation
(`command:proposals:write`), and the additional person-data grant
(`command:data:people`). OAuth identity scopes grant no Command tool access;
missing application permissions deny every tool. Proposal writes never bypass
the transactional review RPC. Restrictive RLS policies deny OAuth-client tokens
direct access to public user tables and guarded UI RPCs; the MCP Edge Function
uses its service credential with an explicit owner filter. The Calendar
function also refuses connected-client tokens, so Calendar writes remain a
separate, first-party action. Its manual export accepts only owned, open
canonical commitments that are deadlines, milestones, or mock-interview
drills; event content is re-read server-side, existing links resync
idempotently, and closing or archiving the source unlinks the event. Google
refresh tokens remain AES-256-GCM encrypted with the edge-only
`GOOGLE_TOKEN_KEY`.

V3 migrations `0013`–`0037` are applied to both local and production Supabase.
Migrations `0026`–`0032` are Phase 6 security and agent work; `0033`–`0037` add
the bounded Run read, registry administration, atomic plugin outcomes,
plugin-schema enforcement, and exact retry results. Both v3 Edge Functions are
deployed in production with `--no-verify-jwt` and retain their required
request-level authentication. The public frontend remains Phase 4 until the
corrected Gazette candidate passes acceptance and the remaining smoke gate.

Do not run the production workflow merely to verify a code change. Migration
application, function deployment, and production smoke tests require an
explicit release action.
