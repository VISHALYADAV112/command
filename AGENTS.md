# AGENTS.md

Guidance for humans and AI agents working in this repository.

## What this is

**Command** — a mobile-first personal operating dashboard. React 19 + TypeScript +
Vite PWA on Vercel, backed by Supabase (Google auth, Postgres + RLS, Google
Calendar and MCP edge functions). `command-v3-implementation-plan.md` is the
source of truth for the v3 migration and wins over older specs and prototypes.
Outside that migration, the current spec docs win over this file; this file wins
over habit. Deployment details live in `docs/deployment.md` and decisions in
`docs/adr/`.

## Verify before you finish

```bash
npm test        # vitest — must pass
npx tsc -b      # typecheck — must be clean
npm run build   # production build — must succeed
```

CI runs all three on every push and PR. Do not push red.

## Code principles

- Keep code simple, clear, and easy to understand.
- Prefer straightforward solutions over clever or over-engineered ones.
- Make the smallest reasonable change required.
- Do not rewrite or refactor working code unless necessary.
- Reuse existing logic instead of duplicating it.
- Avoid unnecessary abstractions, layers, wrappers, and inheritance.
- Prioritize readability, maintainability, and simplicity.

### Stack-specific application

- **No classes.** React function components only; domain logic (`src/domain.ts`)
  stays pure functions. The OOP clause of "where appropriate" almost never
  applies here.
- **File size:** aim for ~100–150 lines, but split **opportunistically** — when
  you are already editing a file that has outgrown its responsibility, extract
  the unrelated part. Never do big-bang refactors of working code.
- **Split by responsibility:** views in `src/views/*`, shared UI primitives
  (`Sheet`, `Icon`, `uid`) in `src/ui.tsx`, pure logic in `domain.ts`, remote
  calls in `lib/api.ts`, row↔model conversion in `lib/mappers.ts`.
- **Data flow:** components never call Supabase directly. They call mutators
  from `useCommandData` (optimistic local update first, then fire-and-forget
  remote write via `lib/api`). Keep that shape.
- **Naming:** match existing vocabulary — bindu, floors, kolam, zones, sheets —
  and keep DB snake_case ↔ app camelCase conversions inside `mappers.ts` only.

## Project conventions

- IDs are client-generated UUIDs (`uid()` → valid uuid, no textual prefixes —
  every remote `id` column is `uuid` typed); UI creates and edits use upsert so
  they share one path. MCP writes create validated, idempotent proposals keyed
  by owner/client/key; retries return the existing proposal and must never
  overwrite a later UI edit. Inserts include `user_id` explicitly.
- Dates are `YYYY-MM-DD` strings via `dateKey`; weeks start Monday.
- Failures surface as bounded quiet messages (toast / muted text), never alert().
- Secrets: only publishable keys in browser env (`VITE_*`). Service keys live in
  edge-function secrets. Never commit `.env*`.
- Migrations are append-only SQL files in `supabase/migrations/` — edit an
  applied migration never; add the next number.
- Both edge functions deploy with `--no-verify-jwt` and perform request-level
  authentication themselves. The Calendar OAuth callback arrives
  unauthenticated by design and is protected by one-time state + PKCE; the MCP
  function verifies its OAuth bearer token before serving requests.
- Supabase OAuth scopes are identity-only. Command MCP permissions are separate
  owner/client application grants; connected-client tokens cannot access public
  tables, first-party mutation RPCs, permission management, or Calendar directly.
- Until the coordinated Phase 8 cutover, v3 work stays on `command-v3` and the
  public Vercel alias stays pinned to the compatible Phase 4 deployment. Do not
  apply v3 migrations or deploy v3 Edge Functions to production early.
