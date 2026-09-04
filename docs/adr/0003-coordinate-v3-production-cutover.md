# ADR 0003: Coordinate the v3 production cutover

- **Status:** Accepted
- **Date:** 2026-09-01

## Context

The v3 frontend reads `entity_types`, `entities`, `commitments`, and
`activity_events` during authenticated startup. Those tables and their RPCs are
introduced by additive migrations that also backfill the existing production
records. Deploying the Phase 5 frontend before applying that schema caused the
authenticated app to fail on the missing `public.entity_types` table.

The public alias was restored to the compatible Phase 4 deployment. No
production migration, function, or data change accompanied the failed frontend
release.

## Decision

Treat the first production v3 release as one controlled Phase 8 cutover, not as
independent frontend and backend deployments. Keep ongoing work on
`command-v3`, and hold the Vercel production alias on Phase 4 until an accepted
frontend candidate is released. (That release happened on 2026-09-04 at
`ef9a8d0`; the alias now serves v3 and the first canonical write is still
pending.)

The cutover order is:

1. Produce and verify a private production export.
2. Enter the short single-user maintenance window.
3. Apply pending additive migrations and the idempotent backfill.
4. Verify counts, mappings, fields, commitments, ownership, and exports.
5. Deploy the v3 frontend and Edge Functions.
6. Run the authenticated production smoke-test checklist.

## Consequences

- Phase implementation may be validated locally and in CI without exposing it
  at the public production alias.
- A push or merge that would cause Vercel to replace the pinned production
  deployment is not part of normal Phase 5–7 work.
- Production database migrations are not applied early merely to make a preview
  frontend load.
- After the first successful v3 production write, fixes move forward; the
  database is not destructively rolled back and legacy tables remain intact.

## Execution checkpoint — 2026-09-03

Steps 1–5 passed through the backend and candidate-frontend deployment. The
candidate then failed owner visual acceptance before the first canonical v3
write. In accordance with the pre-write boundary, the exact Phase 4 frontend
was restored while the additive v3 database, verified backfill, v3 functions,
legacy tables, encrypted export, and private cutover record were preserved.

The corrected Gazette frontend is a new immutable release candidate. It must
pass local verification, owner visual acceptance, explicit release
authorization, and authenticated read-only smoke checks before the alias moves
and the first write establishes the fix-forward boundary.
