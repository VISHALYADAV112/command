-- Keep the built-in behaviour contract valid even for owner-authenticated
-- registry writes outside the Command UI RPC.

create function public.enforce_entity_type_plugin_contract()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.plugin_key = 'spaced_repetition' and (
    not ('review' = any(new.allowed_commitment_kinds))
    or not exists (
      select 1 from jsonb_array_elements(new.field_schema) field
      where field ->> 'key' = 'confidence'
        and field ->> 'kind' = 'number'
        and coalesce((field ->> 'required')::boolean, false)
        and not coalesce((field ->> 'deprecated')::boolean, false)
    )
    or not exists (
      select 1 from jsonb_array_elements(new.field_schema) field
      where field ->> 'key' = 'mastery_hits'
        and field ->> 'kind' = 'number'
        and coalesce((field ->> 'required')::boolean, false)
        and not coalesce((field ->> 'deprecated')::boolean, false)
    )
    or not exists (
      select 1 from jsonb_array_elements(new.field_schema) field
      where field ->> 'key' = 'last_reviewed_on'
        and field ->> 'kind' = 'date'
        and not coalesce((field ->> 'deprecated')::boolean, false)
    )
  ) then
    raise exception using errcode = '23514', message = 'spaced repetition requires review, confidence, mastery_hits, and last_reviewed_on';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_entity_type_plugin_contract() from public, anon, authenticated;

create trigger entity_types_enforce_plugin_contract
  before insert or update on public.entity_types
  for each row execute function public.enforce_entity_type_plugin_contract();
