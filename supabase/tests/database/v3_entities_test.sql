begin;

select plan(42);

select has_table('public', 'entities', 'entities table exists');
select ok(
  to_regclass('public.entities_user_archive_updated_idx') is not null,
  'entities has an owner/archive recency index'
);
select ok(
  to_regclass('public.entities_user_type_archive_updated_idx') is not null,
  'entities has an owner/type/archive recency index'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.entities'::regclass),
  'entities has RLS enabled'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'entities'),
  3,
  'entities has select, insert, and update policies'
);
select ok(
  has_table_privilege('authenticated', 'public.entities', 'select'),
  'authenticated users may select entities'
);
select ok(
  not has_table_privilege('authenticated', 'public.entities', 'insert'),
  'authenticated users must use transactional RPCs to insert entities'
);
select ok(
  not has_table_privilege('authenticated', 'public.entities', 'update'),
  'authenticated users must use transactional RPCs to update entities'
);
select ok(
  not has_table_privilege('authenticated', 'public.entities', 'delete'),
  'normal workflows cannot hard-delete entities'
);
select ok(
  not has_table_privilege('anon', 'public.entities', 'select'),
  'anonymous users cannot read entities'
);
select ok(
  not has_function_privilege('authenticated', 'public.valid_entity_fields(jsonb,jsonb)', 'execute'),
  'authenticated users cannot bypass writes through the field validator'
);
select ok(
  not has_function_privilege('authenticated', 'public.enforce_entity_contract()', 'execute'),
  'authenticated users cannot invoke the privileged entity trigger directly'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entities'::regclass
      and conname = 'entities_owned_type_fk'
      and contype = 'f'
  ),
  'entities enforce the same-owner type relationship'
);

set local session_replication_role = replica;
insert into public.profiles (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'one-entity@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'two-entity@example.test');
set local session_replication_role = origin;

insert into public.entity_types (
  id, user_id, type_key, singular_name, plural_name, field_schema
) values
  (
    '33333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    'bounded_record', 'Bounded record', 'Bounded records',
    '[
      {"key":"company","label":"Company","kind":"text","required":true},
      {"key":"notes","label":"Notes","kind":"textarea"},
      {"key":"score","label":"Score","kind":"number"},
      {"key":"referred","label":"Referred","kind":"boolean"},
      {"key":"applied_on","label":"Applied on","kind":"date"},
      {"key":"job_url","label":"Job URL","kind":"url"},
      {"key":"stage","label":"Stage","kind":"single_select","options":["screen","technical"]},
      {"key":"legacy","label":"Legacy","kind":"text","deprecated":true}
    ]'::jsonb
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    '22222222-2222-4222-8222-222222222222',
    'foreign_record', 'Foreign record', 'Foreign records',
    '[{"key":"company","label":"Company","kind":"text","required":true}]'::jsonb
  );

insert into public.entities (
  id, user_id, entity_type_id, title, fields, schema_version
) values (
  '66666666-6666-4666-8666-666666666666',
  '22222222-2222-4222-8222-222222222222',
  '44444444-4444-4444-8444-444444444444',
  'Other owner record', '{"company":"Other"}'::jsonb, 1
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select is(
  (select count(*)::integer from public.entities),
  0,
  'a user cannot see another owner''s entities'
);

reset role;

select lives_ok(
  $$
    insert into public.entities (
      id, user_id, entity_type_id, title, fields, schema_version
    ) values (
      '55555555-5555-4555-8555-555555555555',
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333',
      'Acme — Engineer',
      '{
        "company":"Acme","notes":"Follow up","score":4.5,
        "referred":true,"applied_on":"2026-08-31",
        "job_url":"https://example.test/job","stage":"screen",
        "legacy":"preserved"
      }'::jsonb,
      1
    )
  $$,
  'a user can create an entity matching an active owned schema'
);
select is(
  (select count(*)::integer from public.entities
    where user_id = '11111111-1111-4111-8111-111111111111'),
  1,
  'the valid entity is stored for its owner'
);
select throws_ok(
  $$
    insert into public.entities (user_id, entity_type_id, title, fields, schema_version)
    values (
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333',
      'Missing required', '{"score":1}'::jsonb, 1
    )
  $$,
  '23514',
  'entity fields do not match the active type schema',
  'required fields cannot be omitted'
);
select throws_ok(
  $$
    insert into public.entities (user_id, entity_type_id, title, fields, schema_version)
    values (
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333',
      'Unknown field', '{"company":"Acme","surprise":true}'::jsonb, 1
    )
  $$,
  '23514',
  'entity fields do not match the active type schema',
  'unknown fields are rejected'
);
select throws_ok(
  $$
    insert into public.entities (user_id, entity_type_id, title, fields, schema_version)
    values (
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333',
      'Wrong type', '{"company":"Acme","score":"high"}'::jsonb, 1
    )
  $$,
  '23514',
  'entity fields do not match the active type schema',
  'field JSON types must match the registry'
);
select throws_ok(
  $$
    insert into public.entities (user_id, entity_type_id, title, fields, schema_version)
    values (
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333',
      'Bad date', '{"company":"Acme","applied_on":"2026-02-30"}'::jsonb, 1
    )
  $$,
  '23514',
  'entity fields do not match the active type schema',
  'calendar-invalid dates are rejected'
);
select throws_ok(
  $$
    insert into public.entities (user_id, entity_type_id, title, fields, schema_version)
    values (
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333',
      'Bad URL', '{"company":"Acme","job_url":"javascript:unsafe"}'::jsonb, 1
    )
  $$,
  '23514',
  'entity fields do not match the active type schema',
  'URL fields accept only bounded HTTP or HTTPS values'
);
select throws_ok(
  $$
    insert into public.entities (user_id, entity_type_id, title, fields, schema_version)
    values (
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333',
      'Bad select', '{"company":"Acme","stage":"offer"}'::jsonb, 1
    )
  $$,
  '23514',
  'entity fields do not match the active type schema',
  'single-select values must come from the schema options'
);
select throws_ok(
  $$
    insert into public.entities (user_id, entity_type_id, title, fields, schema_version)
    values (
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333',
      'Oversized text', jsonb_build_object('company', repeat('x', 501)), 1
    )
  $$,
  '23514',
  'entity fields do not match the active type schema',
  'field values are bounded'
);
select throws_ok(
  $$
    insert into public.entities (user_id, entity_type_id, title, fields, schema_version)
    values (
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333',
      'Wrong version', '{"company":"Acme"}'::jsonb, 2
    )
  $$,
  '23514',
  'entity schema version must match the active type',
  'new rows must record the active schema version'
);
select throws_ok(
  $$
    insert into public.entities (user_id, entity_type_id, title, fields, schema_version)
    values (
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444444',
      'Foreign type', '{"company":"Acme"}'::jsonb, 1
    )
  $$,
  '23514',
  'entity writes require an active owned type',
  'an entity cannot use another owner''s type'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select throws_ok(
  $$
    insert into public.entities (user_id, entity_type_id, title, fields, schema_version)
    values (
      '22222222-2222-4222-8222-222222222222',
      '44444444-4444-4444-8444-444444444444',
      'Other owner insert', '{"company":"Other"}'::jsonb, 1
    )
  $$,
  '42501',
  'permission denied for table entities',
  'authenticated users cannot bypass transactional writes for another owner'
);

reset role;

select lives_ok(
  $$
    update public.entities
    set title = 'Acme — Senior Engineer'
    where id = '55555555-5555-4555-8555-555555555555'
  $$,
  'an owner can update an entity title'
);
select lives_ok(
  $$
    update public.entities
    set fields = jsonb_set(fields, '{stage}', '"technical"'::jsonb)
    where id = '55555555-5555-4555-8555-555555555555'
  $$,
  'an owner can update fields against the active schema'
);
select throws_ok(
  $$
    update public.entities
    set id = '77777777-7777-4777-8777-777777777777'
    where id = '55555555-5555-4555-8555-555555555555'
  $$,
  '23514',
  'entity ids are permanent',
  'entity ids cannot change'
);
select throws_ok(
  $$
    update public.entities
    set user_id = '22222222-2222-4222-8222-222222222222'
    where id = '55555555-5555-4555-8555-555555555555'
  $$,
  '23514',
  'entity ownership cannot change',
  'entity ownership cannot change'
);
select throws_ok(
  $$
    update public.entities
    set entity_type_id = '44444444-4444-4444-8444-444444444444'
    where id = '55555555-5555-4555-8555-555555555555'
  $$,
  '23514',
  'entity types are permanent',
  'an entity cannot change type'
);
select throws_ok(
  $$
    update public.entities
    set created_at = created_at - interval '1 day'
    where id = '55555555-5555-4555-8555-555555555555'
  $$,
  '23514',
  'entity creation timestamps are permanent',
  'entity creation timestamps cannot change'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select throws_ok(
  $$
    update public.entities
    set title = 'Changed by other owner'
    where user_id = '22222222-2222-4222-8222-222222222222'
  $$,
  '42501',
  'permission denied for table entities',
  'authenticated users cannot bypass transactional updates'
);

reset role;

select lives_ok(
  $$
    update public.entity_types
    set field_schema = jsonb_set(field_schema, '{0,label}', '"Organisation"'::jsonb),
      schema_version = 2
    where id = '33333333-3333-4333-8333-333333333333'
  $$,
  'the owner can evolve the type while existing rows retain their version'
);
select lives_ok(
  $$
    update public.entities
    set archived_at = now()
    where id = '55555555-5555-4555-8555-555555555555'
  $$,
  'a stale-schema entity can still be archived'
);
select lives_ok(
  $$
    update public.entities
    set archived_at = null
    where id = '55555555-5555-4555-8555-555555555555'
  $$,
  'a stale-schema entity can still be restored'
);
select lives_ok(
  $$
    update public.entities
    set title = 'Historical Acme record'
    where id = '55555555-5555-4555-8555-555555555555'
  $$,
  'a stale-schema entity title remains editable'
);
select throws_ok(
  $$
    update public.entities
    set fields = jsonb_set(fields, '{company}', '"New Acme"'::jsonb)
    where id = '55555555-5555-4555-8555-555555555555'
  $$,
  '23514',
  'entity schema version must match the active type',
  'field edits require an explicit schema-version migration'
);
select lives_ok(
  $$
    update public.entity_types
    set is_active = false
    where id = '33333333-3333-4333-8333-333333333333'
  $$,
  'an entity type can be disabled without deleting records'
);
select lives_ok(
  $$
    update public.entities
    set archived_at = now()
    where id = '55555555-5555-4555-8555-555555555555'
  $$,
  'an entity remains archivable after its type is disabled'
);
select throws_ok(
  $$
    insert into public.entities (user_id, entity_type_id, title, fields, schema_version)
    values (
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333',
      'Disabled type', '{"company":"Acme"}'::jsonb, 2
    )
  $$,
  '23514',
  'entity writes require an active owned type',
  'disabled types cannot receive new entities'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select throws_ok(
  $$ delete from public.entities where id = '55555555-5555-4555-8555-555555555555' $$,
  '42501',
  'permission denied for table entities',
  'hard delete is unavailable to normal users'
);

select * from finish();
rollback;
