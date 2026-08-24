# AGENTS.md

Guidance for humans and AI agents working in this repository.

## What this is

**Command** — a mobile-first personal operating dashboard. React 19 + TypeScript +
Vite PWA on GitHub Pages, backed by Supabase (Google auth, Postgres + RLS,
one edge function). Spec docs: `command-os-spec.md`, `command-system-design.md`,
`command-design-brief.md`. The spec wins over this file; this file wins over habit.

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

- IDs are client-generated (`uid('app')` → `app-<uuid>`); writes use upsert so
  create and edit share one path.
- Dates are `YYYY-MM-DD` strings via `dateKey`; weeks start Monday.
- Failures surface as bounded quiet messages (toast / muted text), never alert().
- Secrets: only publishable keys in browser env (`VITE_*`). Service keys live in
  edge-function secrets. Never commit `.env*`.
- Migrations are append-only SQL files in `supabase/migrations/` — edit an
  applied migration never; add the next number.
- The edge function validates the user JWT itself (deployed with
  `--no-verify-jwt`; the OAuth callback arrives unauthenticated by design and is
  protected by one-time state + PKCE).
