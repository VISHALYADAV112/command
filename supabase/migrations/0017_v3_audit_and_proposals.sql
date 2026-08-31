-- Command v3 data foundation, slice 4: immutable provenance and agent review.

create or replace function public.valid_activity_payload(p_payload jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  with recursive nodes(value, depth) as (
    select p_payload, 1
    union all
    select child.value, parent.depth + 1
    from nodes parent
    cross join lateral (
      select value
      from jsonb_each(
        case when jsonb_typeof(parent.value) = 'object'
          then parent.value else '{}'::jsonb end
      )
      union all
      select value
      from jsonb_array_elements(
        case when jsonb_typeof(parent.value) = 'array'
          then parent.value else '[]'::jsonb end
      )
    ) child
    where parent.depth <= 5
  )
  select p_payload is not null
    and jsonb_typeof(p_payload) = 'object'
    and octet_length(p_payload::text) <= 32768
    and count(*) <= 200
    and coalesce(max(depth), 0) <= 5
    and coalesce(max(
      case when jsonb_typeof(value) = 'string'
        then char_length(value #>> '{}') else 0 end
    ), 0) <= 5000
  from nodes;
$$;

revoke all on function public.valid_activity_payload(jsonb) from public, anon, authenticated;

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entity_id uuid,
  commitment_id uuid,
  event_type text not null check (
    event_type ~ '^[a-z][a-z0-9_.-]{0,99}$'
  ),
  payload jsonb not null default '{}'::jsonb check (
    public.valid_activity_payload(payload)
  ),
  source text not null check (source in ('ui', 'mcp', 'calendar', 'migration')),
  client_id text check (
    client_id is null
    or (nullif(btrim(client_id), '') is not null and char_length(client_id) <= 200)
  ),
  idempotency_key text check (
    idempotency_key is null
    or (char_length(idempotency_key) between 8 and 200 and idempotency_key = btrim(idempotency_key))
  ),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint activity_events_user_id_id_unique unique (user_id, id),
  constraint activity_events_owned_entity_fk foreign key (user_id, entity_id)
    references public.entities (user_id, id) on delete restrict,
  constraint activity_events_owned_commitment_fk foreign key (user_id, commitment_id)
    references public.commitments (user_id, id) on delete restrict,
  constraint activity_events_mcp_client_required check (
    source <> 'mcp' or client_id is not null
  )
);

create unique index activity_events_idempotency_idx
  on public.activity_events (
    user_id, source, coalesce(client_id, ''), idempotency_key
  ) where idempotency_key is not null;
create index activity_events_user_occurred_idx
  on public.activity_events (user_id, occurred_at desc, id desc);
create index activity_events_user_entity_occurred_idx
  on public.activity_events (user_id, entity_id, occurred_at desc, id desc)
  where entity_id is not null;

create or replace function public.enforce_activity_event_contract()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  commitment_entity_id uuid;
begin
  if tg_op <> 'INSERT' then
    raise exception using errcode = '23514', message = 'activity events are immutable';
  end if;

  if new.commitment_id is not null then
    select entity_id into commitment_entity_id
    from public.commitments
    where user_id = new.user_id and id = new.commitment_id;

    if not found then
      raise exception using errcode = '23514', message = 'activity events require an owned commitment';
    end if;
    if new.entity_id is null then
      new.entity_id := commitment_entity_id;
    elsif new.entity_id <> commitment_entity_id then
      raise exception using errcode = '23514', message = 'activity event references must share one entity';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_activity_event_contract() from public, anon, authenticated;

create trigger activity_events_enforce_contract
  before insert or update or delete on public.activity_events
  for each row execute function public.enforce_activity_event_contract();

alter table public.activity_events enable row level security;
revoke all on public.activity_events from anon, authenticated;
grant select on public.activity_events to authenticated;
grant all on public.activity_events to service_role;

create policy "activity_events_select_own" on public.activity_events
  for select using (user_id = auth.uid());

create or replace function public.valid_agent_proposal_payload(
  p_user_id uuid,
  p_operation text,
  p_entity_type_id uuid,
  p_target_entity_id uuid,
  p_target_commitment_id uuid,
  p_entity_payload jsonb,
  p_commitment_payload jsonb
) returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  active_schema jsonb;
  active_schema_version integer;
  allowed_kinds text[];
  owned_type_id uuid;
  owned_entity_id uuid;
  payload_id uuid;
  payload_schema_version integer;
  payload_due_on date;
  payload_title text;
  payload_action text;
  payload_outcome text;
begin
  if p_operation not in (
    'capture', 'update_entity', 'archive_entity', 'schedule', 'complete', 'cancel'
  ) or p_entity_type_id is null then
    return false;
  end if;
  if p_entity_payload is not null and (
    jsonb_typeof(p_entity_payload) <> 'object'
    or octet_length(p_entity_payload::text) > 65536
  ) then
    return false;
  end if;
  if p_commitment_payload is not null and (
    jsonb_typeof(p_commitment_payload) <> 'object'
    or octet_length(p_commitment_payload::text) > 16384
  ) then
    return false;
  end if;

  if p_operation = 'capture' then
    if p_target_entity_id is not null
      or p_target_commitment_id is not null
      or p_commitment_payload is not null
      or p_entity_payload is null
      or p_entity_payload - array['id', 'title', 'fields', 'schema_version']::text[] <> '{}'::jsonb
      or not p_entity_payload ?& array['id', 'title', 'fields', 'schema_version']::text[]
    then
      return false;
    end if;

    select field_schema, schema_version into active_schema, active_schema_version
    from public.entity_types
    where user_id = p_user_id and id = p_entity_type_id and is_active;
    if not found then return false; end if;

    payload_id := (p_entity_payload ->> 'id')::uuid;
    payload_title := p_entity_payload ->> 'title';
    payload_schema_version := (p_entity_payload ->> 'schema_version')::integer;
    return payload_id is not null
      and nullif(btrim(payload_title), '') is not null
      and char_length(payload_title) <= 200
      and payload_schema_version = active_schema_version
      and public.valid_entity_fields(p_entity_payload -> 'fields', active_schema);
  end if;

  if p_operation in ('update_entity', 'archive_entity', 'schedule') then
    if p_target_entity_id is null or p_target_commitment_id is not null then
      return false;
    end if;
    select entity_type_id into owned_type_id
    from public.entities
    where user_id = p_user_id and id = p_target_entity_id;
    if not found or owned_type_id <> p_entity_type_id then return false; end if;
  end if;

  if p_operation = 'update_entity' then
    if p_commitment_payload is not null
      or p_entity_payload is null
      or p_entity_payload - array['title', 'fields', 'schema_version']::text[] <> '{}'::jsonb
      or not p_entity_payload ?& array['title', 'fields', 'schema_version']::text[]
    then
      return false;
    end if;
    select field_schema, schema_version into active_schema, active_schema_version
    from public.entity_types
    where user_id = p_user_id and id = p_entity_type_id and is_active;
    if not found then return false; end if;

    payload_title := p_entity_payload ->> 'title';
    payload_schema_version := (p_entity_payload ->> 'schema_version')::integer;
    return nullif(btrim(payload_title), '') is not null
      and char_length(payload_title) <= 200
      and payload_schema_version = active_schema_version
      and public.valid_entity_fields(p_entity_payload -> 'fields', active_schema);
  end if;

  if p_operation = 'archive_entity' then
    return p_commitment_payload is null
      and p_entity_payload is not null
      and p_entity_payload - array['archived']::text[] = '{}'::jsonb
      and p_entity_payload ? 'archived'
      and jsonb_typeof(p_entity_payload -> 'archived') = 'boolean';
  end if;

  if p_operation = 'schedule' then
    if p_entity_payload is not null
      or p_commitment_payload is null
      or p_commitment_payload - array['id', 'kind', 'action', 'due_on']::text[] <> '{}'::jsonb
      or not p_commitment_payload ?& array['id', 'kind', 'action', 'due_on']::text[]
    then
      return false;
    end if;
    select entity_type.allowed_commitment_kinds into allowed_kinds
    from public.entity_types entity_type
    where entity_type.user_id = p_user_id and entity_type.id = p_entity_type_id;
    if not found then return false; end if;

    payload_id := (p_commitment_payload ->> 'id')::uuid;
    payload_action := p_commitment_payload ->> 'action';
    payload_due_on := (p_commitment_payload ->> 'due_on')::date;
    return payload_id is not null
      and p_commitment_payload ->> 'kind' = any(allowed_kinds)
      and nullif(btrim(payload_action), '') is not null
      and char_length(payload_action) <= 500
      and payload_due_on is not null;
  end if;

  if p_operation in ('complete', 'cancel') then
    if p_target_entity_id is null
      or p_target_commitment_id is null
      or p_entity_payload is not null
      or p_commitment_payload is null
      or p_commitment_payload - array['outcome']::text[] <> '{}'::jsonb
      or not p_commitment_payload ? 'outcome'
    then
      return false;
    end if;
    select commitment.entity_id, entity.entity_type_id
      into owned_entity_id, owned_type_id
    from public.commitments commitment
    join public.entities entity
      on entity.user_id = commitment.user_id and entity.id = commitment.entity_id
    where commitment.user_id = p_user_id and commitment.id = p_target_commitment_id;
    if not found
      or owned_entity_id <> p_target_entity_id
      or owned_type_id <> p_entity_type_id
    then
      return false;
    end if;

    payload_outcome := p_commitment_payload ->> 'outcome';
    return nullif(btrim(payload_outcome), '') is not null
      and char_length(payload_outcome) <= 5000;
  end if;

  return false;
exception when others then
  return false;
end;
$$;

revoke all on function public.valid_agent_proposal_payload(
  uuid, text, uuid, uuid, uuid, jsonb, jsonb
) from public, anon, authenticated;

create table public.agent_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  client_id text not null check (
    nullif(btrim(client_id), '') is not null and char_length(client_id) <= 200
  ),
  operation text not null check (
    operation in ('capture', 'update_entity', 'archive_entity', 'schedule', 'complete', 'cancel')
  ),
  entity_type_id uuid not null,
  target_entity_id uuid,
  target_commitment_id uuid,
  target_updated_at timestamptz,
  proposed_entity jsonb,
  proposed_commitment jsonb,
  state text not null default 'pending' check (
    state in ('pending', 'approved', 'rejected', 'expired')
  ),
  decision_note text check (
    decision_note is null or char_length(decision_note) <= 2000
  ),
  result_entity_id uuid,
  result_commitment_id uuid,
  result_event_id uuid,
  idempotency_key text not null check (
    char_length(idempotency_key) between 8 and 200
    and idempotency_key = btrim(idempotency_key)
  ),
  expires_at timestamptz not null default (now() + interval '7 days'),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint agent_proposals_owned_type_fk foreign key (user_id, entity_type_id)
    references public.entity_types (user_id, id) on delete restrict,
  constraint agent_proposals_owned_target_entity_fk foreign key (user_id, target_entity_id)
    references public.entities (user_id, id) on delete restrict,
  constraint agent_proposals_owned_target_commitment_fk foreign key (user_id, target_commitment_id)
    references public.commitments (user_id, id) on delete restrict,
  constraint agent_proposals_owned_result_entity_fk foreign key (user_id, result_entity_id)
    references public.entities (user_id, id) on delete restrict,
  constraint agent_proposals_owned_result_commitment_fk foreign key (user_id, result_commitment_id)
    references public.commitments (user_id, id) on delete restrict,
  constraint agent_proposals_owned_result_event_fk foreign key (user_id, result_event_id)
    references public.activity_events (user_id, id) on delete restrict,
  constraint agent_proposals_expiry_valid check (
    expires_at > created_at and expires_at <= created_at + interval '30 days'
  ),
  constraint agent_proposals_target_version_valid check (
    (operation in ('update_entity', 'archive_entity', 'complete', 'cancel')
      and target_updated_at is not null)
    or (operation in ('capture', 'schedule') and target_updated_at is null)
  ),
  constraint agent_proposals_decision_shape_valid check (
    (state = 'pending' and decided_at is null and decision_note is null
      and result_entity_id is null and result_commitment_id is null and result_event_id is null)
    or (state = 'approved' and decided_at is not null
      and result_entity_id is not null and result_event_id is not null)
    or (state in ('rejected', 'expired') and decided_at is not null
      and result_entity_id is null and result_commitment_id is null and result_event_id is null)
  )
);

create unique index agent_proposals_idempotency_idx
  on public.agent_proposals (user_id, client_id, idempotency_key);
create index agent_proposals_user_state_created_idx
  on public.agent_proposals (user_id, state, created_at desc, id desc);

create or replace function public.enforce_agent_proposal_contract()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  event_entity_id uuid;
  event_commitment_id uuid;
begin
  if tg_op = 'INSERT' then
    if new.state <> 'pending' then
      raise exception using errcode = '23514', message = 'new agent proposals must be pending';
    end if;
  else
    if new.id is distinct from old.id
      or new.user_id is distinct from old.user_id
      or new.client_id is distinct from old.client_id
      or new.operation is distinct from old.operation
      or new.entity_type_id is distinct from old.entity_type_id
      or new.target_entity_id is distinct from old.target_entity_id
      or new.target_commitment_id is distinct from old.target_commitment_id
      or new.target_updated_at is distinct from old.target_updated_at
      or new.idempotency_key is distinct from old.idempotency_key
      or new.expires_at is distinct from old.expires_at
      or new.created_at is distinct from old.created_at
    then
      raise exception using errcode = '23514', message = 'agent proposal identity and targets are permanent';
    end if;
    if old.state <> 'pending' or new.state = 'pending' then
      raise exception using errcode = '23514', message = 'agent proposal decisions are permanent';
    end if;
    if new.state = 'approved' and new.expires_at <= now() then
      raise exception using errcode = '23514', message = 'expired agent proposals cannot be approved';
    end if;
    if new.state <> 'approved' and (
      new.proposed_entity is distinct from old.proposed_entity
      or new.proposed_commitment is distinct from old.proposed_commitment
    ) then
      raise exception using errcode = '23514', message = 'only approval may edit a proposal payload';
    end if;
  end if;

  if tg_op = 'INSERT' or new.state = 'approved' then
    if not public.valid_agent_proposal_payload(
      new.user_id, new.operation, new.entity_type_id,
      new.target_entity_id, new.target_commitment_id,
      new.proposed_entity, new.proposed_commitment
    ) then
      raise exception using errcode = '23514', message = 'agent proposal payload is invalid';
    end if;
  end if;

  if new.state = 'approved' then
    if new.operation in ('schedule', 'complete', 'cancel')
      and new.result_commitment_id is null
    then
      raise exception using errcode = '23514', message = 'approved commitment proposals require a result commitment';
    end if;
    if new.operation in ('capture', 'update_entity', 'archive_entity')
      and new.result_commitment_id is not null
    then
      raise exception using errcode = '23514', message = 'entity-only proposals cannot return a commitment';
    end if;

    select entity_id, commitment_id into event_entity_id, event_commitment_id
    from public.activity_events
    where user_id = new.user_id and id = new.result_event_id;
    if not found
      or event_entity_id is distinct from new.result_entity_id
      or event_commitment_id is distinct from new.result_commitment_id
    then
      raise exception using errcode = '23514', message = 'proposal results must match the approval event';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_agent_proposal_contract() from public, anon, authenticated;

create trigger agent_proposals_enforce_contract
  before insert or update on public.agent_proposals
  for each row execute function public.enforce_agent_proposal_contract();

alter table public.agent_proposals enable row level security;
revoke all on public.agent_proposals from anon, authenticated;
grant select on public.agent_proposals to authenticated;
grant all on public.agent_proposals to service_role;

create policy "agent_proposals_select_own" on public.agent_proposals
  for select using (user_id = auth.uid());
