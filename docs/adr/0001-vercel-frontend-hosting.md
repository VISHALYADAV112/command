# ADR 0001: Host the frontend on Vercel

- **Status:** Accepted
- **Date:** 2026-08-31

## Context

Command was originally designed and deployed as a GitHub Pages project. The
repository later moved the frontend to Vercel, removed the Pages deployment
workflow, and changed the OAuth consent path from the old project-site prefix to
`/oauth/consent`. Some repository guidance still described GitHub Pages.

## Decision

Vercel is the production host for the static React/Vite frontend. Its Git
integration deploys `main`. GitHub Actions remains responsible for verification
and for a separate, manually dispatched Supabase backend deployment; it does not
deploy the frontend.

Keep hash routing for the current app. It already provides stable bookmarks and
does not require server rewrites. Moving hosts alone is not a reason to replace
the router or change route URLs.

## Consequences

- Frontend build variables are configured in Vercel.
- `APP_ORIGIN` and allowed OAuth origins use the Vercel application origin.
- GitHub Pages deployment instructions and workflows are obsolete.
- Supabase migrations and Edge Functions remain independently deployable and
  require an explicit manual action.
- A future hosting or route-strategy change requires a new ADR and a tested OAuth
  callback/bookmark migration.
