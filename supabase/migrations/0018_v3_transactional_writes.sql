-- Command v3 data foundation, slice 5: transactional canonical writes and proposal decisions.

create or replace function public.write_v3_entity(
  p_id uuid,
  p_entity_type_id uuid,
  p_title text,
  p_fields jsonb,
  p_schema_version integer,
  p_archived_at timestamptz,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_event_id uuid;
  existing_entity_id uuid;
  existing_commitment_id uuid;
  event_id uuid := gen_random_uuid();
  event_type text;
  previous_archived_at timestamptz;
  entity_exists boolean;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;
  if p_id is null
    or p_idempotency_key is null
    or char_length(p_idempotency_key) not between 8 and 200
    or p_idempotency_key <> btrim(p_idempotency_key)
  then
    raise exception using errcode = '22023', message = 'invalid entity write request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    current_user_id::text || ':ui:' || p_idempotency_key, 0
  ));

  select id, entity_id, commitment_id
    into existing_event_id, existing_entity_id, existing_commitment_id
  from public.activity_events
  where user_id = current_user_id
    and source = 'ui'
    and client_id is null
    and idempotency_key = p_idempotency_key;

  if found then
    if existing_entity_id is null or existing_commitment_id is not null then
      raise exception using errcode = '23514', message = 'idempotency key belongs to another mutation';
    end if;
    return jsonb_build_object(
      'entity_id', existing_entity_id,
      'event_id', existing_event_id,
      'replayed', true
    );
  end if;

  select archived_at into previous_archived_at
  from public.entities
  where user_id = current_user_id and id = p_id
  for update;
  entity_exists := found;

  if not entity_exists and exists (select 1 from public.entities where id = p_id) then
    raise exception using errcode = '42501', message = 'entity not found';
  end if;

  if entity_exists then
    update public.entities
    set entity_type_id = p_entity_type_id,
      title = p_title,
      fields = p_fields,
      schema_version = p_schema_version,
      archived_at = p_archived_at
    where user_id = current_user_id and id = p_id;

    event_type := case
      when previous_archived_at is null and p_archived_at is not null then 'entity.archived'
      when previous_archived_at is not null and p_archived_at is null then 'entity.restored'
      else 'entity.updated'
    end;
  else
    insert into public.entities (
      id, user_id, entity_type_id, title, fields, schema_version, archived_at
    ) values (
      p_id, current_user_id, p_entity_type_id, p_title, p_fields,
      p_schema_version, p_archived_at
    );
    event_type := 'entity.created';
  end if;

  insert into public.activity_events (
    id, user_id, entity_id, event_type, payload, source, idempotency_key
  ) values (
    event_id, current_user_id, p_id, event_type,
    jsonb_build_object('mutation', event_type, 'entity_id', p_id),
    'ui', p_idempotency_key
  );

  return jsonb_build_object(
    'entity_id', p_id,
    'event_id', event_id,
    'replayed', false
  );
end;
$$;

revoke all on function public.write_v3_entity(
  uuid, uuid, text, jsonb, integer, timestamptz, text
) from public, anon;
grant execute on function public.write_v3_entity(
  uuid, uuid, text, jsonb, integer, timestamptz, text
) to authenticated;

create or replace function public.write_v3_commitment(
  p_id uuid,
  p_entity_id uuid,
  p_kind text,
  p_action text,
  p_due_on date,
  p_state text,
  p_outcome text,
  p_completed_at timestamptz,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_event_id uuid;
  existing_entity_id uuid;
  existing_commitment_id uuid;
  event_id uuid := gen_random_uuid();
  event_type text;
  previous_state text;
  commitment_exists boolean;
  normalized_outcome text;
  normalized_completed_at timestamptz;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;
  if p_id is null
    or p_idempotency_key is null
    or char_length(p_idempotency_key) not between 8 and 200
    or p_idempotency_key <> btrim(p_idempotency_key)
  then
    raise exception using errcode = '22023', message = 'invalid commitment write request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    current_user_id::text || ':ui:' || p_idempotency_key, 0
  ));

  select id, entity_id, commitment_id
    into existing_event_id, existing_entity_id, existing_commitment_id
  from public.activity_events
  where user_id = current_user_id
    and source = 'ui'
    and client_id is null
    and idempotency_key = p_idempotency_key;

  if found then
    if existing_commitment_id is null then
      raise exception using errcode = '23514', message = 'idempotency key belongs to another mutation';
    end if;
    return jsonb_build_object(
      'entity_id', existing_entity_id,
      'commitment_id', existing_commitment_id,
      'event_id', existing_event_id,
      'replayed', true
    );
  end if;

  normalized_outcome := case when p_state = 'open' then null else p_outcome end;
  normalized_completed_at := case
    when p_state = 'completed' then coalesce(p_completed_at, now())
    else null
  end;

  select state into previous_state
  from public.commitments
  where user_id = current_user_id and id = p_id
  for update;
  commitment_exists := found;

  if not commitment_exists and exists (select 1 from public.commitments where id = p_id) then
    raise exception using errcode = '42501', message = 'commitment not found';
  end if;

  if commitment_exists then
    update public.commitments
    set entity_id = p_entity_id,
      kind = p_kind,
      action = p_action,
      due_on = p_due_on,
      state = p_state,
      outcome = normalized_outcome,
      completed_at = normalized_completed_at
    where user_id = current_user_id and id = p_id;

    event_type := case
      when previous_state = 'open' and p_state = 'completed' then 'commitment.completed'
      when previous_state = 'open' and p_state = 'cancelled' then 'commitment.cancelled'
      else 'commitment.updated'
    end;
  else
    insert into public.commitments (
      id, user_id, entity_id, kind, action, due_on,
      state, outcome, completed_at, origin_source
    ) values (
      p_id, current_user_id, p_entity_id, p_kind, p_action, p_due_on,
      p_state, normalized_outcome, normalized_completed_at, 'ui'
    );
    event_type := 'commitment.created';
  end if;

  insert into public.activity_events (
    id, user_id, entity_id, commitment_id, event_type,
    payload, source, idempotency_key
  ) values (
    event_id, current_user_id, p_entity_id, p_id, event_type,
    jsonb_build_object('mutation', event_type, 'commitment_id', p_id),
    'ui', p_idempotency_key
  );

  return jsonb_build_object(
    'entity_id', p_entity_id,
    'commitment_id', p_id,
    'event_id', event_id,
    'replayed', false
  );
end;
$$;

revoke all on function public.write_v3_commitment(
  uuid, uuid, text, text, date, text, text, timestamptz, text
) from public, anon;
grant execute on function public.write_v3_commitment(
  uuid, uuid, text, text, date, text, text, timestamptz, text
) to authenticated;

create or replace function public.create_agent_proposal(
  p_user_id uuid,
  p_client_id text,
  p_operation text,
  p_entity_type_id uuid,
  p_target_entity_id uuid,
  p_target_commitment_id uuid,
  p_entity_payload jsonb,
  p_commitment_payload jsonb,
  p_idempotency_key text,
  p_expires_at timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  existing_proposal public.agent_proposals%rowtype;
  proposal_id uuid := gen_random_uuid();
  final_entity_payload jsonb := p_entity_payload;
  final_commitment_payload jsonb := p_commitment_payload;
  target_version timestamptz;
begin
  if p_user_id is null
    or nullif(btrim(p_client_id), '') is null
    or char_length(btrim(p_client_id)) > 200
    or p_idempotency_key is null
    or char_length(p_idempotency_key) not between 8 and 200
    or p_idempotency_key <> btrim(p_idempotency_key)
  then
    raise exception using errcode = '22023', message = 'invalid agent proposal request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_user_id::text || ':mcp:' || btrim(p_client_id) || ':' || p_idempotency_key, 0
  ));

  select * into existing_proposal
  from public.agent_proposals
  where user_id = p_user_id
    and client_id = btrim(p_client_id)
    and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'proposal_id', existing_proposal.id,
      'state', existing_proposal.state,
      'replayed', true
    );
  end if;

  if p_operation = 'capture'
    and jsonb_typeof(final_entity_payload) = 'object'
    and not final_entity_payload ? 'id'
  then
    final_entity_payload := jsonb_set(
      final_entity_payload, '{id}', to_jsonb(gen_random_uuid()::text)
    );
  end if;
  if p_operation = 'schedule'
    and jsonb_typeof(final_commitment_payload) = 'object'
    and not final_commitment_payload ? 'id'
  then
    final_commitment_payload := jsonb_set(
      final_commitment_payload, '{id}', to_jsonb(gen_random_uuid()::text)
    );
  end if;

  if p_operation in ('update_entity', 'archive_entity') then
    select updated_at into target_version
    from public.entities
    where user_id = p_user_id and id = p_target_entity_id;
  elsif p_operation in ('complete', 'cancel') then
    select updated_at into target_version
    from public.commitments
    where user_id = p_user_id and id = p_target_commitment_id;
  end if;

  insert into public.agent_proposals (
    id, user_id, client_id, operation, entity_type_id,
    target_entity_id, target_commitment_id, target_updated_at,
    proposed_entity, proposed_commitment, idempotency_key, expires_at
  ) values (
    proposal_id, p_user_id, btrim(p_client_id), p_operation, p_entity_type_id,
    p_target_entity_id, p_target_commitment_id, target_version,
    final_entity_payload, final_commitment_payload, p_idempotency_key,
    coalesce(p_expires_at, now() + interval '7 days')
  );

  return jsonb_build_object(
    'proposal_id', proposal_id,
    'state', 'pending',
    'replayed', false
  );
end;
$$;

revoke all on function public.create_agent_proposal(
  uuid, text, text, uuid, uuid, uuid, jsonb, jsonb, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.create_agent_proposal(
  uuid, text, text, uuid, uuid, uuid, jsonb, jsonb, text, timestamptz
) to service_role;

create or replace function public.decide_agent_proposal(
  p_proposal_id uuid,
  p_decision text,
  p_entity_payload jsonb default null,
  p_commitment_payload jsonb default null,
  p_decision_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := auth.uid();
  proposal public.agent_proposals%rowtype;
  final_entity_payload jsonb;
  final_commitment_payload jsonb;
  current_target_version timestamptz;
  approval_entity_id uuid;
  approval_commitment_id uuid;
  approval_event_id uuid := gen_random_uuid();
  approval_event_type text;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;
  if p_decision not in ('approve', 'reject')
    or (p_decision_note is not null and char_length(p_decision_note) > 2000)
  then
    raise exception using errcode = '22023', message = 'invalid proposal decision';
  end if;

  select * into proposal
  from public.agent_proposals
  where user_id = current_user_id and id = p_proposal_id
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'agent proposal not found';
  end if;
  if proposal.state <> 'pending' then
    raise exception using errcode = '23514', message = 'agent proposal was already decided';
  end if;

  if proposal.expires_at <= now() then
    update public.agent_proposals
    set state = 'expired', decided_at = now(), decision_note = p_decision_note
    where id = proposal.id;
    return jsonb_build_object('proposal_id', proposal.id, 'state', 'expired');
  end if;

  if p_decision = 'reject' then
    update public.agent_proposals
    set state = 'rejected', decided_at = now(), decision_note = p_decision_note
    where id = proposal.id;
    return jsonb_build_object('proposal_id', proposal.id, 'state', 'rejected');
  end if;

  final_entity_payload := coalesce(p_entity_payload, proposal.proposed_entity);
  final_commitment_payload := coalesce(p_commitment_payload, proposal.proposed_commitment);

  if not public.valid_agent_proposal_payload(
    proposal.user_id, proposal.operation, proposal.entity_type_id,
    proposal.target_entity_id, proposal.target_commitment_id,
    final_entity_payload, final_commitment_payload
  ) then
    raise exception using errcode = '23514', message = 'agent proposal payload is invalid';
  end if;

  if proposal.operation in ('update_entity', 'archive_entity') then
    select updated_at into current_target_version
    from public.entities
    where user_id = proposal.user_id and id = proposal.target_entity_id
    for update;
  elsif proposal.operation in ('complete', 'cancel') then
    select updated_at into current_target_version
    from public.commitments
    where user_id = proposal.user_id and id = proposal.target_commitment_id
    for update;
  end if;
  if proposal.target_updated_at is not null
    and current_target_version is distinct from proposal.target_updated_at
  then
    raise exception using errcode = '40001', message = 'proposal target changed; review a new proposal';
  end if;

  if proposal.operation = 'capture' then
    approval_entity_id := (final_entity_payload ->> 'id')::uuid;
    insert into public.entities (
      id, user_id, entity_type_id, title, fields, schema_version
    ) values (
      approval_entity_id, proposal.user_id, proposal.entity_type_id,
      final_entity_payload ->> 'title', final_entity_payload -> 'fields',
      (final_entity_payload ->> 'schema_version')::integer
    );
    approval_event_type := 'entity.created';
  elsif proposal.operation = 'update_entity' then
    approval_entity_id := proposal.target_entity_id;
    update public.entities
    set title = final_entity_payload ->> 'title',
      fields = final_entity_payload -> 'fields',
      schema_version = (final_entity_payload ->> 'schema_version')::integer
    where user_id = proposal.user_id and id = approval_entity_id;
    approval_event_type := 'entity.updated';
  elsif proposal.operation = 'archive_entity' then
    approval_entity_id := proposal.target_entity_id;
    update public.entities
    set archived_at = case
      when (final_entity_payload ->> 'archived')::boolean
        then coalesce(archived_at, now())
      else null
    end
    where user_id = proposal.user_id and id = approval_entity_id;
    approval_event_type := case
      when (final_entity_payload ->> 'archived')::boolean
        then 'entity.archived' else 'entity.restored' end;
  elsif proposal.operation = 'schedule' then
    approval_entity_id := proposal.target_entity_id;
    approval_commitment_id := (final_commitment_payload ->> 'id')::uuid;
    insert into public.commitments (
      id, user_id, entity_id, kind, action, due_on, origin_source
    ) values (
      approval_commitment_id, proposal.user_id, approval_entity_id,
      final_commitment_payload ->> 'kind', final_commitment_payload ->> 'action',
      (final_commitment_payload ->> 'due_on')::date, 'mcp'
    );
    approval_event_type := 'commitment.created';
  elsif proposal.operation = 'complete' then
    approval_entity_id := proposal.target_entity_id;
    approval_commitment_id := proposal.target_commitment_id;
    update public.commitments
    set state = 'completed', outcome = final_commitment_payload ->> 'outcome',
      completed_at = now()
    where user_id = proposal.user_id and id = approval_commitment_id;
    approval_event_type := 'commitment.completed';
  elsif proposal.operation = 'cancel' then
    approval_entity_id := proposal.target_entity_id;
    approval_commitment_id := proposal.target_commitment_id;
    update public.commitments
    set state = 'cancelled', outcome = final_commitment_payload ->> 'outcome',
      completed_at = null
    where user_id = proposal.user_id and id = approval_commitment_id;
    approval_event_type := 'commitment.cancelled';
  end if;

  insert into public.activity_events (
    id, user_id, entity_id, commitment_id, event_type, payload,
    source, client_id, idempotency_key
  ) values (
    approval_event_id, proposal.user_id, approval_entity_id, approval_commitment_id,
    approval_event_type,
    jsonb_build_object(
      'mutation', approval_event_type,
      'proposal_id', proposal.id,
      'operation', proposal.operation
    ),
    'mcp', proposal.client_id, proposal.id::text
  );

  update public.agent_proposals
  set proposed_entity = final_entity_payload,
    proposed_commitment = final_commitment_payload,
    state = 'approved',
    decision_note = p_decision_note,
    result_entity_id = approval_entity_id,
    result_commitment_id = approval_commitment_id,
    result_event_id = approval_event_id,
    decided_at = now()
  where id = proposal.id;

  return jsonb_build_object(
    'proposal_id', proposal.id,
    'state', 'approved',
    'entity_id', approval_entity_id,
    'commitment_id', approval_commitment_id,
    'event_id', approval_event_id
  );
end;
$$;

revoke all on function public.decide_agent_proposal(
  uuid, text, jsonb, jsonb, text
) from public, anon;
grant execute on function public.decide_agent_proposal(
  uuid, text, jsonb, jsonb, text
) to authenticated;

-- Canonical writes must pass through the transactional RPCs above.
revoke insert, update on public.entities from authenticated;
