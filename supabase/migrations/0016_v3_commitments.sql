-- Command v3 data foundation, slice 3: canonical dated commitments.

create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entity_id uuid not null,
  kind text not null check (
    kind in ('follow-up', 'deadline', 'review', 'contact', 'drill', 'milestone')
  ),
  action text not null check (
    nullif(btrim(action), '') is not null and char_length(action) <= 500
  ),
  due_on date not null,
  state text not null default 'open' check (
    state in ('open', 'completed', 'cancelled')
  ),
  outcome text check (
    outcome is null or (nullif(btrim(outcome), '') is not null and char_length(outcome) <= 5000)
  ),
  completed_at timestamptz,
  origin_source text not null check (
    origin_source in ('ui', 'mcp', 'calendar', 'migration')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commitments_user_id_id_unique unique (user_id, id),
  constraint commitments_owned_entity_fk foreign key (user_id, entity_id)
    references public.entities (user_id, id) on delete restrict,
  constraint commitments_state_details_valid check (
    (state = 'open' and outcome is null and completed_at is null)
    or (state = 'completed' and outcome is not null and completed_at is not null)
    or (state = 'cancelled' and outcome is not null and completed_at is null)
  )
);

create index commitments_user_state_due_idx
  on public.commitments (user_id, state, due_on, id);
create index commitments_user_entity_state_due_idx
  on public.commitments (user_id, entity_id, state, due_on, id);

create or replace function public.enforce_commitment_contract()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  allowed_kinds text[];
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception using errcode = '23514', message = 'commitment ids are permanent';
    end if;
    if new.user_id is distinct from old.user_id then
      raise exception using errcode = '23514', message = 'commitment ownership cannot change';
    end if;
    if new.entity_id is distinct from old.entity_id then
      raise exception using errcode = '23514', message = 'commitment entities are permanent';
    end if;
    if new.origin_source is distinct from old.origin_source then
      raise exception using errcode = '23514', message = 'commitment origin cannot change';
    end if;
    if new.created_at is distinct from old.created_at then
      raise exception using errcode = '23514', message = 'commitment creation timestamps are permanent';
    end if;
    if old.state <> 'open' and new.state <> old.state then
      raise exception using errcode = '23514', message = 'closed commitment states are terminal';
    end if;

    if new.kind is not distinct from old.kind then
      return new;
    end if;
  end if;

  select entity_type.allowed_commitment_kinds
    into allowed_kinds
  from public.entities entity
  join public.entity_types entity_type
    on entity_type.user_id = entity.user_id
    and entity_type.id = entity.entity_type_id
  where entity.user_id = new.user_id
    and entity.id = new.entity_id;

  if not found then
    raise exception using errcode = '23514', message = 'commitment writes require an owned entity';
  end if;
  if not new.kind = any(allowed_kinds) then
    raise exception using errcode = '23514', message = 'commitment kind is not allowed for the entity type';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_commitment_contract() from public, anon, authenticated;

create trigger commitments_enforce_contract
  before insert or update on public.commitments
  for each row execute function public.enforce_commitment_contract();
create trigger commitments_set_updated_at
  before update on public.commitments
  for each row execute function public.set_updated_at();

alter table public.commitments enable row level security;
revoke all on public.commitments from anon, authenticated;
grant select on public.commitments to authenticated;
grant all on public.commitments to service_role;

create policy "commitments_select_own" on public.commitments
  for select using (user_id = auth.uid());
create policy "commitments_insert_own" on public.commitments
  for insert with check (user_id = auth.uid());
create policy "commitments_update_own" on public.commitments
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
