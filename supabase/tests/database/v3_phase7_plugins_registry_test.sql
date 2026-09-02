begin;

select plan(24);

select ok(
  has_function_privilege('authenticated', 'public.write_v3_entity_type(uuid,text,text,text,text,integer,jsonb,text,text,text,text[],text,boolean)', 'execute'),
  'authenticated owners may administer their registry'
);
select ok(
  not has_function_privilege('anon', 'public.write_v3_entity_type(uuid,text,text,text,text,integer,jsonb,text,text,text,text[],text,boolean)', 'execute'),
  'anonymous callers cannot administer registry types'
);
select ok(
  has_function_privilege('authenticated', 'public.write_v3_plugin_outcome(uuid,text,timestamp with time zone,text,uuid,date,text)', 'execute'),
  'authenticated owners may apply a plugin outcome atomically'
);
select ok(
  not has_function_privilege('anon', 'public.write_v3_plugin_outcome(uuid,text,timestamp with time zone,text,uuid,date,text)', 'execute'),
  'anonymous callers cannot apply plugin outcomes'
);

set local session_replication_role = replica;
insert into public.profiles (id, email) values
  ('d1000000-0000-4000-8000-000000000001', 'phase7-plugin@example.test');
set local session_replication_role = origin;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$ select public.write_v3_entity_type(
    'd2000000-0000-4000-8000-000000000002', 'book', 'Book', 'Books', 'generic', 1,
    '[{"key":"author","label":"Author","kind":"text","list_visible":true}]'::jsonb,
    'updated_at', 'desc', null, array['milestone']::text[], null, true
  ) $$,
  'a data-only registry type can be created without deployment'
);
select is(
  (select type_key from public.entity_types where id = 'd2000000-0000-4000-8000-000000000002'),
  'book',
  'the custom type is owner-scoped and stored'
);
select lives_ok(
  $$ select public.write_v3_entity_type(
    'd2000000-0000-4000-8000-000000000002', 'book', 'Book', 'Books', 'generic', 2,
    '[{"key":"author","label":"Writer","kind":"text","list_visible":true}]'::jsonb,
    'updated_at', 'desc', null, array['milestone']::text[], null, false
  ) $$,
  'an existing field label may change while the type is disabled'
);
select is(
  (select schema_version from public.entity_types where id = 'd2000000-0000-4000-8000-000000000002'),
  2,
  'a field schema edit advances exactly one version'
);
select throws_ok(
  $$ select public.write_v3_entity_type(
    'd3000000-0000-4000-8000-000000000003', 'bad_recall', 'Bad recall', 'Bad recalls', 'generic', 1,
    '[]'::jsonb, 'updated_at', 'desc', null, array['review']::text[], 'spaced_repetition', true
  ) $$,
  '23514',
  'spaced repetition requires review, confidence, mastery_hits, and last_reviewed_on',
  'the allow-listed plugin still requires its data contract'
);
select throws_ok(
  $$ insert into public.entity_types (
    user_id, type_key, singular_name, plural_name, field_schema,
    allowed_commitment_kinds, plugin_key
  ) values (
    'd1000000-0000-4000-8000-000000000001', 'direct_bad_recall',
    'Direct bad recall', 'Direct bad recalls', '[]'::jsonb,
    array['review']::text[], 'spaced_repetition'
  ) $$,
  '23514',
  'spaced repetition requires review, confidence, mastery_hits, and last_reviewed_on',
  'direct owner writes cannot bypass the plugin registry contract'
);
select throws_ok(
  $$ select public.write_v3_entity_type(
    'd2000000-0000-4000-8000-000000000002', 'renamed_book', 'Book', 'Books', 'generic', 2,
    '[{"key":"author","label":"Writer","kind":"text","list_visible":true}]'::jsonb,
    'updated_at', 'desc', null, array['milestone']::text[], null, false
  ) $$,
  '23514',
  'entity type keys are permanent',
  'an existing type key cannot be reinterpreted'
);

select lives_ok(
  $$ select public.write_v3_entity_type(
    'd4000000-0000-4000-8000-000000000004', 'recall_card', 'Recall card', 'Recall cards', 'learning', 1,
    '[
      {"key":"confidence","label":"Confidence","kind":"number","required":true},
      {"key":"mastery_hits","label":"Mastery hits","kind":"number","required":true},
      {"key":"last_reviewed_on","label":"Last reviewed","kind":"date"}
    ]'::jsonb,
    'updated_at', 'desc', null, array['review']::text[], 'spaced_repetition', true
  ) $$,
  'a compatible custom type can select the built-in recall plugin'
);
select lives_ok(
  $$ select public.write_v3_entity(
    'd5000000-0000-4000-8000-000000000005',
    'd4000000-0000-4000-8000-000000000004',
    'Window invariant', '{"confidence":4,"mastery_hits":1,"last_reviewed_on":null}'::jsonb,
    1, null, 'phase7-plugin-entity'
  ) $$,
  'a generic plugin-backed entity can be created'
);
select lives_ok(
  $$ select public.write_v3_commitment(
    'd6000000-0000-4000-8000-000000000006',
    'd5000000-0000-4000-8000-000000000005',
    'review', 'Review window invariant', '2026-09-02', 'open', null, null,
    'phase7-plugin-review'
  ) $$,
  'the plugin uses an ordinary generic commitment'
);
select lives_ok(
  $$ select public.write_v3_plugin_outcome(
    'd6000000-0000-4000-8000-000000000006', 'Recalled with effort',
    '2026-09-02T06:00:00Z', 'effort',
    'd7000000-0000-4000-8000-000000000007', '2026-09-12',
    'phase7-plugin-outcome'
  ) $$,
  'Outcome atomically applies recall and an owner-adjusted follow-on date'
);
select is(
  (select state from public.commitments where id = 'd6000000-0000-4000-8000-000000000006'),
  'completed',
  'the original review is completed'
);
select is(
  (select fields from public.entities where id = 'd5000000-0000-4000-8000-000000000005'),
  '{"confidence":4,"mastery_hits":0,"last_reviewed_on":"2026-09-02"}'::jsonb,
  'the plugin updates only its generic recall fields'
);
select results_eq(
  $$ select kind, due_on, state from public.commitments where id = 'd7000000-0000-4000-8000-000000000007' $$,
  $$ values ('review'::text, '2026-09-12'::date, 'open'::text) $$,
  'the adjusted follow-on is an ordinary review commitment'
);
select is(
  (select count(*)::integer from public.activity_events
    where idempotency_key in ('phase7-plugin-outcome', 'phase7-plugin-outcome:entity', 'phase7-plugin-outcome:follow-up')),
  3,
  'the atomic path appends outcome, entity, and follow-on provenance'
);
select is(
  (public.write_v3_plugin_outcome(
    'd6000000-0000-4000-8000-000000000006', 'Changed retry',
    '2026-09-02T06:00:00Z', 'blank', null, null,
    'phase7-plugin-outcome'
  ) ->> 'replayed')::boolean,
  true,
  'a retry returns the original plugin result before changed state is validated'
);
select is(
  public.write_v3_plugin_outcome(
    'd6000000-0000-4000-8000-000000000006', 'Another changed retry',
    '2026-09-02T06:00:00Z', 'blank', null, null,
    'phase7-plugin-outcome'
  ) ->> 'next_commitment_id',
  'd7000000-0000-4000-8000-000000000007',
  'a retry returns the originally created follow-on id'
);
select is(
  (select count(*)::integer from public.commitments where entity_id = 'd5000000-0000-4000-8000-000000000005'),
  2,
  'a plugin retry cannot duplicate the follow-on commitment'
);

select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","client_id":"phase7-oauth-client"}', true);
select throws_ok(
  $$ select public.write_v3_entity_type(
    'd8000000-0000-4000-8000-000000000008', 'bypass', 'Bypass', 'Bypasses', 'generic', 1,
    '[]'::jsonb, 'updated_at', 'desc', null, '{}'::text[], null, true
  ) $$,
  '42501',
  'OAuth clients must use Command MCP tools',
  'OAuth clients cannot mutate registry types directly'
);
select throws_ok(
  $$ select public.write_v3_plugin_outcome(
    'd6000000-0000-4000-8000-000000000006', 'Bypass', now(), 'effort', null, null,
    'phase7-oauth-bypass'
  ) $$,
  '42501',
  'OAuth clients must use Command MCP tools',
  'OAuth clients cannot bypass proposal review through plugin outcomes'
);

select * from finish();
rollback;
