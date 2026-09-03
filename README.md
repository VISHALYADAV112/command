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
- Registry-driven v3 source routes for Today, Due, Week, Run, Browse, and universal Item,
  with generic Capture/Edit, Schedule, Outcome, archive/restore, drafts, and
  bounded pagination. These workflows remain off the public production alias
  until the v3 data cutover.
- A bounded Monday–Sunday Week review shows the three practice budgets, weekly
  15/2 outcomes, pending future days, proposal activity, and commitment
  outcomes using `Asia/Kolkata` boundaries.
- A monthly Run review derives five readiness markers from canonical entities,
  commitments, and immutable activity. It shows three completed calendar months
  only when the history is sufficient and never fabricates a trend.
- Settings administers current targets and the data-only type registry,
  including versioned fields, browse metadata, commitment kinds, allow-listed
  behaviour, and disable-without-delete. JSON export is canonical and each
  registry type has a schema-driven CSV export.
- Canonical entities and commitments plus immutable activity provenance. Ideas
  migrate to note records tagged `idea`; normal workflows do not expose hard
  delete.
- Fast daily logging and the existing 21/7/3/1 recall schedule now run through
  the generic behaviour-plugin and Outcome contracts, including an adjustable
  follow-on review date and atomic provenance.
- Google sign-in (owner-only via a database signup guard) and Google Calendar:
  connect/disconnect, last verification/sync status, and explicit export of
  approved canonical commitments. OAuth refresh tokens are stored AES-256-GCM
  encrypted in the database with the key held only server-side.
- CSP headers, service-worker update prompt, dynamic JSON/per-type CSV export,
  and PWA install.
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
33. bounded Phase 7 Run summary with five fixed readiness markers and three
completed owner-local calendar months
34–37. Phase 7 first-party type administration, atomic spaced-repetition
outcomes and follow-ons, plugin-schema enforcement, and exact retry results

The `google-calendar` edge function handles the PKCE flow, idempotent event
writes for owner-approved deadline, milestone, and mock-interview commitments,
unlink/resync, token revocation/refresh, request throttling, and request-scoped
CORS; it validates the user JWT itself and derives event content from owned
canonical rows. `supabase/config.toml` records the required
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
Its operator procedure, including the encrypted export, staged backend release,
transactional backfill verification, smoke tests, and fix-forward boundary, is
[`docs/phase8-cutover.md`](docs/phase8-cutover.md).

## Verification

CI runs typecheck/build, Vitest, mobile Playwright flows, and pgTAP RLS tests.
After applying a migration locally, run `npm run db:types` to refresh the
generated Supabase contract; app-specific row aliases live separately in
`src/lib/db.rows.ts`, so regeneration is safe.
Backend deployment is an explicit manual GitHub Action (`Deploy Supabase`) with
separate `migrations` and `functions` stages around the private backfill and
verification gate. Configure its
`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, and `SUPABASE_PROJECT_ID`
secrets. Configure the edge secrets `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_KEY`, and `APP_ORIGIN` in Supabase before
deploying. Only the two publishable `VITE_*` values belong in browser builds.
