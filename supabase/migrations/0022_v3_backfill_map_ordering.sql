-- Append-only correction for Phase 3 backfill ordering.
-- Map rows intentionally precede destination rows so their generated IDs are
-- stable across retries; destination ownership is validated by the backfill
-- transaction before each map is used.

alter table public.v3_legacy_entity_map
  drop constraint v3_legacy_entity_map_entity_fk;
alter table public.v3_legacy_commitment_map
  drop constraint v3_legacy_commitment_map_commitment_fk;
