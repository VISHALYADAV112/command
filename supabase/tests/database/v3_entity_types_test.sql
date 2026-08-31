begin;

select plan(29);

select has_table('public', 'entity_types', 'entity_types table exists');
select ok(
  to_regclass('public.entity_types_user_active_key_idx') is not null,
  'entity_types has an owner and active-state index'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.entity_types'::regclass),
  'entity_types has RLS enabled'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'entity_types'),
  3,
  'entity_types has select, insert, and update policies'
);
select ok(
  has_table_privilege('authenticated', 'public.entity_types', 'select'),
  'authenticated users may select entity types'
);
select ok(
  has_table_privilege('authenticated', 'public.entity_types', 'insert'),
  'authenticated users may insert entity types'
);
select ok(
  has_table_privilege('authenticated', 'public.entity_types', 'update'),
  'authenticated users may update entity types'
);
select ok(
  not has_table_privilege('authenticated', 'public.entity_types', 'delete'),
  'normal workflows cannot hard-delete entity types'
);
select ok(
  not has_table_privilege('anon', 'public.entity_types', 'select'),
  'anonymous users cannot read entity types'
);
select ok(
  not has_function_privilege('authenticated', 'public.seed_default_entity_types(uuid)', 'execute'),
  'authenticated users cannot invoke the privileged seed helper'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and tgname = 'entity_types_seed_after_profile'
      and not tgisinternal
  ),
  'new profiles receive default entity types'
);

set local session_replication_role = replica;
insert into public.profiles (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'one@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'two@example.test');
set local session_replication_role = origin;

do $$
begin
  perform public.seed_default_entity_types('11111111-1111-4111-8111-111111111111');
  perform public.seed_default_entity_types('22222222-2222-4222-8222-222222222222');
  perform public.seed_default_entity_types('11111111-1111-4111-8111-111111111111');
end;
$$;

select results_eq(
  $$
    select user_id::text, count(*)::integer
    from public.entity_types
    group by user_id
    order by user_id
  $$,
  $$
    values
      ('11111111-1111-4111-8111-111111111111'::text, 5::integer),
      ('22222222-2222-4222-8222-222222222222'::text, 5::integer)
  $$,
  'default seeding is owner-scoped and idempotent'
);
select results_eq(
  $$
    select plugin_key, allowed_commitment_kinds
    from public.entity_types
    where user_id = '11111111-1111-4111-8111-111111111111'
      and type_key = 'learning'
  $$,
  $$ values ('spaced_repetition'::text, array['review', 'drill']::text[]) $$,
  'the learning seed selects only the allow-listed recall plugin and commitments'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select is(
  (select count(*)::integer from public.entity_types),
  5,
  'a user sees only their own entity types'
);
select lives_ok(
  $$
    insert into public.entity_types (
      id, user_id, type_key, singular_name, plural_name, field_schema,
      default_sort_field, allowed_commitment_kinds
    ) values (
      '33333333-3333-4333-8333-333333333333',
      '11111111-1111-4111-8111-111111111111',
      'interview_topic', 'Interview topic', 'Interview topics',
      '[{"key":"topic","label":"Topic","kind":"text","required":true,"list_visible":true,"filterable":true}]'::jsonb,
      'topic', array['review', 'drill']::text[]
    )
  $$,
  'a user can create a bounded data-only type'
);
select lives_ok(
  $$
    update public.entity_types
    set field_schema = jsonb_set(field_schema, '{0,label}', '"Renamed topic"'::jsonb),
      schema_version = 2
    where id = '33333333-3333-4333-8333-333333333333'
  $$,
  'a label rename advances the schema version'
);
select lives_ok(
  $$
    update public.entity_types
    set field_schema = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(field_schema, '{0,deprecated}', 'true'::jsonb),
            '{0,required}', 'false'::jsonb
          ),
          '{0,list_visible}', 'false'::jsonb
        ),
        '{0,filterable}', 'false'::jsonb
      ),
      default_sort_field = 'updated_at',
      schema_version = 3
    where id = '33333333-3333-4333-8333-333333333333'
  $$,
  'a field can be deprecated without deleting its key'
);
select throws_ok(
  $$
    update public.entity_types
    set type_key = 'renamed_topic'
    where id = '33333333-3333-4333-8333-333333333333'
  $$,
  '23514',
  'entity type keys are permanent',
  'type keys cannot be renamed'
);
select throws_ok(
  $$
    update public.entity_types
    set field_schema = jsonb_set(field_schema, '{0,kind}', '"number"'::jsonb),
      schema_version = 4
    where id = '33333333-3333-4333-8333-333333333333'
  $$,
  '23514',
  'field kinds are permanent; add a new field and migrate',
  'field kinds cannot change in place'
);
select throws_ok(
  $$
    update public.entity_types
    set field_schema = '[]'::jsonb,
      schema_version = 4
    where id = '33333333-3333-4333-8333-333333333333'
  $$,
  '23514',
  'existing field keys must be retained and deprecated',
  'existing field keys cannot be removed'
);
select throws_ok(
  $$
    insert into public.entity_types (
      user_id, type_key, singular_name, plural_name, field_schema
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'unsafe', 'Unsafe', 'Unsafe',
      '[{"key":"payload","label":"Payload","kind":"html"}]'::jsonb
    )
  $$,
  '23514',
  'new row for relation "entity_types" violates check constraint "entity_types_definition_valid"',
  'unsupported field kinds are rejected'
);
select throws_ok(
  $$
    insert into public.entity_types (
      user_id, type_key, singular_name, plural_name
    ) values (
      '22222222-2222-4222-8222-222222222222',
      'foreign_type', 'Foreign', 'Foreign'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "entity_types"',
  'a user cannot create a type for another owner'
);
select results_eq(
  $$
    update public.entity_types
    set singular_name = 'Changed'
    where user_id = '22222222-2222-4222-8222-222222222222'
    returning type_key
  $$,
  $$ select null::text where false $$,
  'a user cannot update another owner''s type'
);
select lives_ok(
  $$
    update public.entity_types
    set is_active = false
    where type_key = 'note'
  $$,
  'a user can disable a type without deleting it'
);
select is(
  (select is_active from public.entity_types where type_key = 'note'),
  false,
  'the disabled type remains stored'
);
select throws_ok(
  $$ delete from public.entity_types where type_key = 'note' $$,
  '42501',
  'permission denied for table entity_types',
  'hard delete is unavailable to normal users'
);
select throws_ok(
  $$
    update public.entity_types
    set schema_version = schema_version + 1
    where id = '33333333-3333-4333-8333-333333333333'
  $$,
  '23514',
  'schema version changes require a schema change',
  'schema versions cannot advance without a schema change'
);
select throws_ok(
  $$
    insert into public.entity_types (
      user_id, type_key, singular_name, plural_name, allowed_commitment_kinds
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'duplicate_kinds', 'Duplicate kind', 'Duplicate kinds',
      array['review', 'review']::text[]
    )
  $$,
  '23514',
  'new row for relation "entity_types" violates check constraint "entity_types_definition_valid"',
  'duplicate commitment kinds are rejected'
);
select throws_ok(
  $$
    insert into public.entity_types (
      user_id, type_key, singular_name, plural_name, plugin_key
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'uploaded_plugin', 'Uploaded plugin', 'Uploaded plugins', 'user_code'
    )
  $$,
  '23514',
  'new row for relation "entity_types" violates check constraint "entity_types_plugin_key_check"',
  'only allow-listed built-in plugins can be selected'
);

select * from finish();
rollback;
