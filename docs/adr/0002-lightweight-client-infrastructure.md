# ADR 0002: Keep lightweight router, sync, and forms

- **Status:** Accepted
- **Date:** 2026-08-31

## Context

The older system design proposed React Router, TanStack Query, and React Hook
Form. The implemented application instead has a small hash router, controlled
React forms, and focused hooks for loading, optimistic updates, caching, retry,
and status messages. These choices are covered by tests and match the current
single-user application.

Changing all three foundations during v3 would expand the migration without
closing a demonstrated product or reliability gap.

## Decision

Keep the existing repo-native infrastructure:

- `src/routes.tsx` owns hash parsing and navigation.
- `useCommandData` owns application data and exposes mutators.
- `useRemoteSync` owns save state, retry, cache updates, online/offline state,
  and visibility refresh.
- `src/lib/api.ts` owns remote calls; components never call Supabase directly.
- Forms remain controlled React components and reuse shared UI primitives.

Add focused helpers or split files by responsibility as v3 grows, but do not add
a routing, server-state, or form library solely to mirror the older proposal.

## Consequences

- The dependency surface and current optimistic-update behavior stay small and
  understandable.
- Visibility refresh is the first multi-writer freshness mechanism; realtime
  subscriptions remain deferred.
- Registry-generated v3 forms must preserve controlled draft retention and the
  existing API boundary.
- Reconsider a library only when concrete complexity appears—for example nested
  route loaders, cache invalidation the hooks cannot express clearly, or dynamic
  form validation that becomes harder to maintain than the dependency.
