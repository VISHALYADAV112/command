-- Rejection and expiry have no canonical side effects and must remain possible
-- after a proposal target becomes stale. Only creation and approval need a
-- current target.

create or replace function public.enforce_agent_proposal_current_target()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_is_current boolean;
begin
  if new.operation not in ('schedule', 'complete', 'cancel')
    or (tg_op = 'UPDATE' and new.state <> 'approved')
  then
    return new;
  end if;

  select exists (
    select 1
    from public.entities entity
    join public.entity_types entity_type
      on entity_type.user_id = entity.user_id
      and entity_type.id = entity.entity_type_id
    where entity.user_id = new.user_id
      and entity.id = new.target_entity_id
      and entity.archived_at is null
      and entity_type.is_active
  ) into target_is_current;

  if not target_is_current then
    raise exception using errcode = '23514', message = 'agent proposal target is not current';
  end if;

  if tg_op = 'INSERT' and new.operation in ('complete', 'cancel') then
    select exists (
      select 1
      from public.commitments commitment
      where commitment.user_id = new.user_id
        and commitment.id = new.target_commitment_id
        and commitment.entity_id = new.target_entity_id
        and commitment.state = 'open'
    ) into target_is_current;
    if not target_is_current then
      raise exception using errcode = '23514', message = 'agent proposal target is not current';
    end if;
  end if;

  return new;
end;
$$;
