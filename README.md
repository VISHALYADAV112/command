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
```

Deployed automatically to GitHub Pages on every push to `main`.

## Live deployment

- App: https://vishalyadav112.github.io/command/
- Backend: Supabase (Google auth restricted to the owner allow-list)
- Environment: copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`

## Implemented

- Four derived bindu states for today's Node, DSA, Math, and job-hunt floors.
- Fast daily log sheet with habits, diet, minutes, and a short note.
- Monday–Sunday totals against the 7h / 14h / 7h / 7h weekly budgets.
- Closing windows, active applications, people due, and active work on one field.
- Recall-first learning review with the specified 21 / 7 / 3 / 1 day intervals.
- Google sign-in (owner-only via a database signup guard) and Google Calendar:
  connect/disconnect, live "Today" strip of events; OAuth refresh tokens stored
  AES-256-GCM encrypted in the database with the key held only server-side.
- Local demo persistence when unconfigured (`command.prototype.v1`).
- PWA shell, manifest, service worker, exportable SVG assets, JSON/CSV export.

## Data core

Supabase migrations under `supabase/migrations/`:

1. profiles / settings / logs / learning — RLS per operation
2. people / applications / projects / ideas + referrer integrity trigger
3. profile bootstrap trigger + integration support tables
4. owner-email allow-list signup guard
5. delete policies for every table
6. integration tables moved to public behind deny-by-default RLS
7. encrypted OAuth token storage column

The `google-calendar` edge function handles the PKCE flow, idempotent event
writes, and token refresh; it validates the user JWT itself.

## Next build boundary

Feature breadth: application lifecycle editing, People/Projects/Ideas views,
concept capture, hash routing, offline draft retention, e2e tests.
