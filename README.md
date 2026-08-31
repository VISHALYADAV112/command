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

The frontend deploys to Vercel from `main`; backend deployment is a separate,
manually dispatched GitHub Actions workflow.

## Live deployment

- App: https://command-beta-flax.vercel.app/
- Backend: Supabase (Google auth restricted to the owner allow-list)
- Environment: copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`

The approved Command v3 migration is tracked in
[`command-v3-implementation-plan.md`](command-v3-implementation-plan.md). It is
the source of truth when older specifications or prototypes conflict.

## Implemented

- Four derived bindu states for today's Node, DSA, Math, and job-hunt floors.
- Fast daily log sheet (with unsaved-draft retention) and recall-first learning
  review using the specified 21 / 7 / 3 / 1 day intervals and mastery retirement.
- Hash-routed views: Today, Jobs, People, Projects, Ideas, Learning.
- Application lifecycle: create/edit/delete with lane, channel, status, CTC,
  applied date, referral state, resume/Drive links, notes, window, follow-up,
  referrer, and job URL; one-tap "Deadline →
  Calendar" writes for applications and projects (idempotent).
- Ideas capture with status progression; concept capture feeding the review
  queue; people list feeding referral selection.
- Google sign-in (owner-only via a database signup guard) and Google Calendar:
  connect/disconnect, live "Today" strip of events; OAuth refresh tokens stored
  AES-256-GCM encrypted in the database with the key held only server-side.
- CSP headers, service-worker update prompt, JSON/CSV export, PWA install.
- Remote MCP access for AI clients through Supabase OAuth 2.1. The initial
  tools expose today/week context, search, projects, applications, learning
  due, and idempotent capture; settings shows and revokes connected clients.

## Connect an AI client

Use the MCP URL shown under **Settings → AI connections**, or:

```text
https://<project-ref>.supabase.co/functions/v1/command-mcp
```

The client discovers Supabase OAuth, opens Command's consent screen, and asks
you to sign in. No model API key is required. Access is limited by the same
Postgres RLS policies as the app, writes are idempotent, and tool calls are
recorded in a private audit log. Clients that support dynamic OAuth client
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
