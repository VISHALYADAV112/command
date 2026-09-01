begin;

select plan(13);

select ok(
  has_function_privilege(
    'authenticated',
    'public.write_v3_capture(uuid,uuid,text,jsonb,integer,uuid,text,text,date,text)',
    'execute'
  ),
  'authenticated users may use atomic capture'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.write_v3_capture(uuid,uuid,text,jsonb,integer,uuid,text,text,date,text)',
    'execute'
  ),
  'anonymous users cannot use atomic capture'
);

set local session_replication_role = replica;
insert into public.profiles (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'phase5-correction@example.test');
set local session_replication_role = origin;

insert into public.entity_types (
  id, user_id, type_key, singular_name, plural_name,
  field_schema, allowed_commitment_kinds
) values (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'application', 'Application', 'Applications',
  '[
    {"key":"company","label":"Company","kind":"text","required":true},
    {"key":"applied_on","label":"Applied on","kind":"date"}
  ]'::jsonb,
  array['follow-up', 'deadline']::text[]
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select lives_ok(
  $$
    select public.write_v3_capture(
      '44444444-4444-4444-8444-444444444444',
      '33333333-3333-4333-8333-333333333333',
      'Acme — Engineer',
      '{"company":"Acme","applied_on":"2026-09-01"}'::jsonb,
      1,
      '55555555-5555-4555-8555-555555555555',
      'follow-up', 'Send a concise follow-up', '2026-09-02',
      'phase5-capture-001'
    )
  $$,
  'atomic capture creates an entity and first commitment'
);
select is(
  (select count(*)::integer from public.entities
    where id = '44444444-4444-4444-8444-444444444444'),
  1,
  'atomic capture stores the entity'
);
select is(
  (select count(*)::integer from public.commitments
    where id = '55555555-5555-4555-8555-555555555555'),
  1,
  'atomic capture stores the first commitment'
);
select results_eq(
  $$
    select event_type from public.activity_events
    where entity_id = '44444444-4444-4444-8444-444444444444'
    order by event_type
  $$,
  $$ values ('application.submitted'), ('commitment.created'), ('entity.created') $$,
  'capture appends canonical and weekly-outcome provenance'
);
select is(
  (public.get_v3_today('2026-09-01', 5) #>> '{weekly,applications_submitted}')::integer,
  1,
  'Today reads the same immutable weekly outcome event as the client'
);

select lives_ok(
  $$
    select public.write_v3_entity_with_outcome(
      '44444444-4444-4444-8444-444444444444',
      '33333333-3333-4333-8333-333333333333',
      'Later UI title',
      '{"company":"Acme","applied_on":"2026-09-01"}'::jsonb,
      1, null, 'phase5-later-edit-002'
    )
  $$,
  'a later UI edit succeeds with a new key'
);
select is(
  (public.write_v3_capture(
    '44444444-4444-4444-8444-444444444444',
    '33333333-3333-4333-8333-333333333333',
    'Stale capture retry',
    '{"company":"Old","applied_on":"2026-09-01"}'::jsonb,
    1,
    '55555555-5555-4555-8555-555555555555',
    'follow-up', 'Stale commitment retry', '2026-09-30',
    'phase5-capture-001'
  ) ->> 'replayed')::boolean,
  true,
  'capture retry returns the original result'
);
select is(
  (select title from public.entities
    where id = '44444444-4444-4444-8444-444444444444'),
  'Later UI title',
  'capture retry cannot overwrite a later UI edit'
);

select throws_ok(
  $$
    select public.write_v3_capture(
      '66666666-6666-4666-8666-666666666666',
      '33333333-3333-4333-8333-333333333333',
      'Rollback candidate', '{"company":"Rollback"}'::jsonb, 1,
      '77777777-7777-4777-8777-777777777777',
      'review', 'Disallowed review', '2026-09-03',
      'phase5-invalid-capture'
    )
  $$,
  '23514',
  'commitment kind is not allowed for the entity type',
  'an invalid first commitment rejects the capture'
);
select is(
  (select count(*)::integer from public.entities
    where id = '66666666-6666-4666-8666-666666666666'),
  0,
  'a failed first commitment rolls back the entity'
);
select is(
  (select count(*)::integer from public.activity_events
    where idempotency_key like 'phase5-invalid-capture%'),
  0,
  'a failed capture leaves no partial provenance'
);

select * from finish();
rollback;
