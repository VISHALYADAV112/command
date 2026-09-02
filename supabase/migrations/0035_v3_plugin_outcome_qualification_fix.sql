-- Qualify activity-event columns in the Phase 7 plugin retry lookup. Migration
-- 0034 has already been applied locally, so this correction is append-only.

create or replace function public.write_v3_plugin_outcome(
  p_commitment_id uuid,
  p_outcome text,
  p_completed_at timestamptz,
  p_recall text,
  p_next_commitment_id uuid,
  p_next_due_on date,
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
  target_entity_id uuid;
  target_entity_type_id uuid;
  target_entity_title text;
  target_entity_fields jsonb;
  target_schema_version integer;
  target_archived_at timestamptz;
  target_field_schema jsonb;
  target_commitment_kind text;
  target_commitment_action text;
  target_commitment_due_on date;
  target_commitment_state text;
  outcome_completed_at timestamptz := coalesce(p_completed_at, now());
  reviewed_on date;
  next_confidence integer;
  next_mastery_hits integer;
  updated_fields jsonb;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;
  if auth.jwt() ->> 'client_id' is not null then
    raise exception using errcode = '42501', message = 'OAuth clients must use Command MCP tools';
  end if;
  if p_commitment_id is null
    or p_idempotency_key is null
    or char_length(p_idempotency_key) not between 8 and 180
    or p_idempotency_key <> btrim(p_idempotency_key)
  then
    raise exception using errcode = '22023', message = 'invalid plugin outcome request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    current_user_id::text || ':ui:' || p_idempotency_key, 0
  ));

  select activity.id, activity.entity_id, activity.commitment_id
    into existing_event_id, existing_entity_id, existing_commitment_id
  from public.activity_events activity
  where activity.user_id = current_user_id
    and activity.source = 'ui'
    and activity.client_id is null
    and activity.idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'entity_id', existing_entity_id,
      'commitment_id', existing_commitment_id,
      'event_id', existing_event_id,
      'next_commitment_id', p_next_commitment_id,
      'replayed', true
    );
  end if;

  select commitment.entity_id, commitment.kind, commitment.action,
    commitment.due_on, commitment.state,
    entity.entity_type_id, entity.title, entity.fields,
    entity.schema_version, entity.archived_at, entity_type.field_schema
  into target_entity_id, target_commitment_kind, target_commitment_action,
    target_commitment_due_on, target_commitment_state,
    target_entity_type_id, target_entity_title, target_entity_fields,
    target_schema_version, target_archived_at, target_field_schema
  from public.commitments commitment
  join public.entities entity
    on entity.user_id = commitment.user_id and entity.id = commitment.entity_id
  join public.entity_types entity_type
    on entity_type.user_id = entity.user_id and entity_type.id = entity.entity_type_id
  where commitment.user_id = current_user_id
    and commitment.id = p_commitment_id
    and entity_type.plugin_key = 'spaced_repetition'
  for update of commitment, entity;

  if not found then
    raise exception using errcode = '42501', message = 'plugin commitment not found';
  end if;
  if target_commitment_state <> 'open' or target_commitment_kind <> 'review'
    or p_recall is null or p_recall not in ('instant', 'effort', 'struggled', 'blank')
  then
    raise exception using errcode = '23514', message = 'invalid spaced-repetition outcome';
  end if;
  if jsonb_typeof(target_entity_fields -> 'confidence') <> 'number'
    or jsonb_typeof(target_entity_fields -> 'mastery_hits') <> 'number'
  then
    raise exception using errcode = '23514', message = 'plugin fields are invalid';
  end if;

  next_confidence := greatest(1, least(5, (target_entity_fields ->> 'confidence')::integer
    + case p_recall when 'instant' then 1 when 'struggled' then -1 when 'blank' then -2 else 0 end));
  next_mastery_hits := case
    when next_confidence = 5 and p_recall = 'instant'
      then greatest(0, (target_entity_fields ->> 'mastery_hits')::integer) + 1
    else 0
  end;
  reviewed_on := (outcome_completed_at at time zone 'Asia/Kolkata')::date;
  updated_fields := jsonb_set(
    jsonb_set(
      jsonb_set(target_entity_fields, '{confidence}', to_jsonb(next_confidence), true),
      '{mastery_hits}', to_jsonb(next_mastery_hits), true
    ),
    '{last_reviewed_on}', to_jsonb(reviewed_on::text), true
  );

  if not public.valid_entity_fields(updated_fields, target_field_schema) then
    raise exception using errcode = '23514', message = 'plugin fields do not match the current schema';
  end if;
  if next_mastery_hits >= 2 then
    if p_next_commitment_id is not null or p_next_due_on is not null then
      raise exception using errcode = '23514', message = 'mastered items do not schedule another review';
    end if;
  elsif p_next_commitment_id is null or p_next_due_on is null or p_next_due_on < reviewed_on then
    raise exception using errcode = '23514', message = 'the next review date is required';
  end if;

  perform public.write_v3_commitment(
    p_commitment_id, target_entity_id, target_commitment_kind, target_commitment_action,
    target_commitment_due_on, 'completed', p_outcome, outcome_completed_at,
    p_idempotency_key
  );
  perform public.write_v3_entity(
    target_entity_id, target_entity_type_id, target_entity_title, updated_fields,
    target_schema_version, target_archived_at, p_idempotency_key || ':entity'
  );
  if p_next_commitment_id is not null then
    perform public.write_v3_commitment(
      p_next_commitment_id, target_entity_id, 'review', target_commitment_action,
      p_next_due_on, 'open', null, null,
      p_idempotency_key || ':follow-up'
    );
  end if;

  return jsonb_build_object(
    'entity_id', target_entity_id,
    'commitment_id', p_commitment_id,
    'next_commitment_id', p_next_commitment_id,
    'replayed', false
  );
end;
$$;
