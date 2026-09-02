-- Return the original follow-on commitment on plugin retries. The 0035
-- implementation remains intact behind this append-only first-party wrapper.

alter function public.write_v3_plugin_outcome(
  uuid, text, timestamptz, text, uuid, date, text
) rename to write_v3_plugin_outcome_phase7_impl;

revoke all on function public.write_v3_plugin_outcome_phase7_impl(
  uuid, text, timestamptz, text, uuid, date, text
) from public, anon, authenticated;

create function public.write_v3_plugin_outcome(
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
  existing_next_commitment_id uuid;
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
    select activity.commitment_id into existing_next_commitment_id
    from public.activity_events activity
    where activity.user_id = current_user_id
      and activity.source = 'ui'
      and activity.client_id is null
      and activity.idempotency_key = p_idempotency_key || ':follow-up';
    return jsonb_build_object(
      'entity_id', existing_entity_id,
      'commitment_id', existing_commitment_id,
      'event_id', existing_event_id,
      'next_commitment_id', existing_next_commitment_id,
      'replayed', true
    );
  end if;

  return public.write_v3_plugin_outcome_phase7_impl(
    p_commitment_id, p_outcome, p_completed_at, p_recall,
    p_next_commitment_id, p_next_due_on, p_idempotency_key
  );
end;
$$;

revoke all on function public.write_v3_plugin_outcome(
  uuid, text, timestamptz, text, uuid, date, text
) from public, anon;
grant execute on function public.write_v3_plugin_outcome(
  uuid, text, timestamptz, text, uuid, date, text
) to authenticated;
