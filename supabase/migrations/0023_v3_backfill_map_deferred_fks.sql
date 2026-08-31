-- Preserve destination ownership integrity while allowing the stable map rows
-- to be inserted before their generated destination rows in one transaction.

alter table public.v3_legacy_entity_map
  add constraint v3_legacy_entity_map_entity_fk foreign key (user_id, entity_id)
    references public.entities (user_id, id) on delete restrict
    deferrable initially deferred;
alter table public.v3_legacy_commitment_map
  add constraint v3_legacy_commitment_map_commitment_fk foreign key (user_id, commitment_id)
    references public.commitments (user_id, id) on delete restrict
    deferrable initially deferred;
