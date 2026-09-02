# Command

A quiet, mobile-first personal operating dashboard — the daily instrument described in the three source documents in this repository, deployed and backed by a secure data core.

## Run it

```bash
npm install
npm run dev          # local dev (demo mode without env vars)
```

Production build & tests:

```bash
npm run build
npm test
npm run test:e2e
```

The frontend normally deploys to Vercel from `main`; backend deployment is a
separate, manually dispatched GitHub Actions workflow. During the v3 migration,
ongoing work stays on `command-v3` and the public alias remains pinned to the
compatible Phase 4 deployment until the controlled Phase 8 cutover.

## Live deployment

- App: https://command-beta-flax.vercel.app/
- Backend: Supabase (Google auth restricted to the owner allow-list)
- Environment: copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`

The approved Command v3 migration is tracked in
[`command-v3-implementation-plan.md`](command-v3-implementation-plan.md). It is
the source of truth when older specifications or prototypes conflict.

## Implemented

- Three daily practice floors for Node, DSA, and Math; historical job-hunt
  minutes remain preserved while weekly outcomes track 15 submitted
  applications and 2 new people contacted.
- Registry-driven v3 source routes for Today, Due, Browse, and universal Item,
  with generic Capture/Edit, Schedule, Outcome, archive/restore, drafts, and
  bounded pagination. These workflows remain off the public production alias
  until the v3 data cutover.
- Canonical entities and commitments plus immutable activity provenance. Ideas
  migrate to note records tagged `idea`; normal workflows do not expose hard
  delete.
- Fast daily logging and the existing recall-first learning schedule remain
  preserved during migration.
- Google sign-in (owner-only via a database signup guard) and Google Calendar:
  connect/disconnect, live "Today" strip of events; OAuth refresh tokens stored
  AES-256-GCM encrypted in the database with the key held only server-side.
- CSP headers, service-worker update prompt, JSON/CSV export, PWA install.
- Remote MCP access through Supabase OAuth 2.1. The Phase 6 source now provides
  five generic registry-aware tools, narrow read/write/people permissions, safe
  bounded queries, and an approval-gated Agent inbox. Production retains the
  compatible Phase 4 gateway until the coordinated cutover.

## Connect an AI client

Use the MCP URL shown under **Settings → AI connections**, or:

```text
https://<project-ref>.supabase.co/functions/v1/command-mcp
```

The client discovers Supabase OAuth, opens Command's consent screen, and asks
you to sign in. No model API key is required. Command grants are separate from
identity scopes: `command:types:read`, `command:data:read`, and
`command:proposals:write`; person records additionally require
`command:data:people`. Reads remain owner-scoped, all writes initially create
idempotent proposals for explicit review, and tool calls are recorded in a
private audit log. Connected-client tokens cannot call PostgREST, first-party
mutation RPCs, or the Calendar function directly; access stays behind the MCP
permission and proposal boundaries. Clients that support dynamic OAuth client
registration need only the URL above.

## Data core

Supabase migrations under `supabase/migrations/`:

1. profiles / settings / logs / learning — RLS per operation
2. people / applications / projects / ideas + referrer integrity trigger
3. profile bootstrap trigger + integration support tables
4. owner-email allow-list signup guard
5. delete policies for every table
6. integration tables moved to public behind deny-by-default RLS
7. encrypted OAuth token storage column
8. referrer deletion cleanup
9. complete application fields and edge-function rate limiting
10. authenticated core-table grants (still owner-filtered by RLS)
11. active-project next-action invariant
12. MCP audit log and user-scoped cross-entity search
13–19. v3 registry, entities, commitments, immutable activity, proposals,
transactional writes, and bounded derived reads
20–24. built-in schemas, idempotent legacy backfill, compatibility reports,
and deferred ownership/Calendar corrections
25. Phase 5 outcome provenance and atomic entity-plus-commitment capture
26–27. Phase 6 current-target guards for agent proposal creation and approval,
with stale rejection kept available
28–32. owner/client MCP application permissions, first-party-only grant
management, direct OAuth database isolation, and guarded UI mutation RPCs,
including the atomic capture/outcome paths

The `google-calendar` edge function handles the PKCE flow, idempotent event
writes, token revocation/refresh, request throttling, and request-scoped CORS;
it validates the user JWT itself. `supabase/config.toml` records the required
`verify_jwt = false` deployment mode because the OAuth callback is protected by
one-time state and PKCE rather than an app JWT.

## Architecture and deployment

The browser is a static React/Vite PWA on Vercel. It uses a deliberately small
hash router, controlled React forms, and `useCommandData`/`useRemoteSync` for
optimistic client state. Components do not call Supabase directly: reads and
writes pass through `src/lib/api.ts`, with row conversion in
`src/lib/mappers.ts`. Supabase owns Google authentication, Postgres/RLS, and the
Google Calendar and Command MCP edge functions.

See [`docs/deployment.md`](docs/deployment.md) for the exact frontend/backend
release paths and secrets boundary. The durable decisions are recorded in
[`docs/adr/0001-vercel-frontend-hosting.md`](docs/adr/0001-vercel-frontend-hosting.md)
and
[`docs/adr/0002-lightweight-client-infrastructure.md`](docs/adr/0002-lightweight-client-infrastructure.md).
The coordinated v3 release boundary is recorded in
[`docs/adr/0003-coordinate-v3-production-cutover.md`](docs/adr/0003-coordinate-v3-production-cutover.md).

## Verification

CI runs typecheck/build, Vitest, mobile Playwright flows, and pgTAP RLS tests.
After applying a migration locally, run `npm run db:types` to refresh the
generated Supabase contract; app-specific row aliases live separately in
`src/lib/db.rows.ts`, so regeneration is safe.
Backend deployment is an explicit manual GitHub Action (`Deploy Supabase`). It
applies migrations, enables the Supabase OAuth server, and deploys both edge
functions. Configure its
`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, and `SUPABASE_PROJECT_ID`
secrets. Configure the edge secrets `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_KEY`, and `APP_ORIGIN` in Supabase before
deploying. Only the two publishable `VITE_*` values belong in browser builds.
