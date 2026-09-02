begin;

select plan(18);

select ok(
  has_function_privilege('authenticated', 'public.get_v3_run(date)', 'execute'),
  'authenticated users may query the bounded Run summary'
);
select ok(
  not has_function_privilege('anon', 'public.get_v3_run(date)', 'execute'),
  'anonymous users cannot query the Run summary'
);

set local role authenticated;
select throws_ok(
  $$ select public.get_v3_run('2026-09-02') $$,
  '28000',
  'authentication required',
  'Run requires an authenticated owner'
);
reset role;

set local session_replication_role = replica;
insert into public.profiles (id, email, timezone, created_at) values
  ('91000000-0000-4000-8000-000000000001', 'run-owner@example.test', 'Asia/Kolkata', '2026-01-01T00:00:00Z'),
  ('92000000-0000-4000-8000-000000000002', 'run-other@example.test', 'Asia/Kolkata', '2026-08-15T00:00:00Z');

insert into public.entity_types (
  id, user_id, type_key, singular_name, plural_name, allowed_commitment_kinds
) values
  ('91100000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'project', 'Project', 'Projects', array['milestone']::text[]),
  ('91100000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', 'learning', 'Learning item', 'Learning', array['drill']::text[]),
  ('91100000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000001', 'application', 'Application', 'Applications', array['milestone']::text[]),
  ('91100000-0000-4000-8000-000000000004', '91000000-0000-4000-8000-000000000001', 'person', 'Person', 'People', array['contact']::text[]),
  ('92100000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000002', 'project', 'Project', 'Projects', array['milestone']::text[]);

insert into public.entities (
  id, user_id, entity_type_id, title, fields, schema_version, created_at, updated_at
) values
  ('91200000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000001', 'June portfolio', '{"project_type":"portfolio","status":"done","is_public":true,"content_markdown":"Documented","repo_url":"https://example.test/repo"}', 1, '2026-05-01T00:00:00Z', '2026-06-10T00:00:00Z'),
  ('91200000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000001', 'August portfolio', '{"project_type":"portfolio","status":"done","is_public":true,"content_markdown":"Documented","demo_url":"https://example.test/demo"}', 1, '2026-07-01T00:00:00Z', '2026-08-10T00:00:00Z'),
  ('91200000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000001', 'Undocumented portfolio', '{"project_type":"portfolio","status":"done","is_public":true,"content_markdown":"","repo_url":"https://example.test/repo"}', 1, '2026-05-01T00:00:00Z', '2026-05-10T00:00:00Z'),
  ('91300000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000002', 'June mastered pattern', '{"track":"dsa","item_type":"pattern","confidence":5,"mastery_hits":2,"last_reviewed_on":"2026-06-15"}', 1, '2026-05-01T00:00:00Z', '2026-06-15T00:00:00Z'),
  ('91300000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000002', 'August mastered pattern', '{"track":"dsa","item_type":"pattern","confidence":5,"mastery_hits":3,"last_reviewed_on":"2026-08-01"}', 1, '2026-07-01T00:00:00Z', '2026-08-01T00:00:00Z'),
  ('91300000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000002', 'Covered pattern', '{"track":"dsa","item_type":"pattern","confidence":4,"mastery_hits":1,"last_reviewed_on":"2026-08-20"}', 1, '2026-08-01T00:00:00Z', '2026-08-20T00:00:00Z'),
  ('91400000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000003', 'June application', '{"status":"phone"}', 1, '2026-06-01T00:00:00Z', '2026-06-20T00:00:00Z'),
  ('91400000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000003', 'July application', '{"status":"oa"}', 1, '2026-07-01T00:00:00Z', '2026-07-20T00:00:00Z'),
  ('91400000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000003', 'August application', '{"status":"offer"}', 1, '2026-08-01T00:00:00Z', '2026-08-20T00:00:00Z'),
  ('91500000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000004', 'First referral contact', '{}', 1, '2026-05-01T00:00:00Z', '2026-05-01T00:00:00Z'),
  ('91500000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', '91100000-0000-4000-8000-000000000004', 'Second referral contact', '{}', 1, '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z'),
  ('92200000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000002', '92100000-0000-4000-8000-000000000001', 'Foreign portfolio', '{"project_type":"portfolio","status":"done","is_public":true,"content_markdown":"Documented","repo_url":"https://example.test/foreign"}', 1, '2026-05-01T00:00:00Z', '2026-05-10T00:00:00Z');

insert into public.commitments (
  id, user_id, entity_id, kind, action, due_on, state, outcome, completed_at, origin_source
) values
  ('91600000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', '91300000-0000-4000-8000-000000000001', 'drill', 'Mock interview: systems', '2026-06-20', 'completed', 'Useful practice', '2026-06-20T10:00:00+05:30', 'ui'),
  ('91600000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', '91300000-0000-4000-8000-000000000002', 'drill', 'Mock interview — algorithms', '2026-08-20', 'completed', 'Useful practice', '2026-08-20T10:00:00+05:30', 'ui'),
  ('91600000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000001', '91300000-0000-4000-8000-000000000003', 'drill', 'Array drill', '2026-07-20', 'completed', 'Useful practice', '2026-07-20T10:00:00+05:30', 'ui'),
  ('91700000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', '91500000-0000-4000-8000-000000000001', 'contact', 'Referral conversation', '2026-06-25', 'completed', 'Spoke', '2026-06-25T10:00:00+05:30', 'ui'),
  ('91700000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', '91500000-0000-4000-8000-000000000001', 'contact', 'Follow-up conversation', '2026-07-25', 'completed', 'Spoke again', '2026-07-25T10:00:00+05:30', 'ui'),
  ('91700000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000001', '91500000-0000-4000-8000-000000000002', 'contact', 'Referral conversation', '2026-08-25', 'completed', 'Spoke', '2026-08-25T10:00:00+05:30', 'ui');

insert into public.activity_events (
  id, user_id, entity_id, event_type, payload, source, idempotency_key, occurred_at, created_at
) values
  ('91800000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', '91400000-0000-4000-8000-000000000001', 'application.submitted', '{}', 'ui', 'run-submit-june', '2026-06-05T10:00:00+05:30', '2026-06-05T10:00:00+05:30'),
  ('91800000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', '91400000-0000-4000-8000-000000000002', 'application.submitted', '{}', 'ui', 'run-submit-july', '2026-07-05T10:00:00+05:30', '2026-07-05T10:00:00+05:30'),
  ('91800000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000001', '91400000-0000-4000-8000-000000000003', 'application.submitted', '{}', 'ui', 'run-submit-august', '2026-08-05T10:00:00+05:30', '2026-08-05T10:00:00+05:30');
set local session_replication_role = origin;

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select results_eq(
  $$ select summary ->> 'as_of_day', summary ->> 'history_start', summary ->> 'history_end'
     from (select public.get_v3_run('2026-09-02') summary) value $$,
  $$ values ('2026-09-02', '2026-06-01', '2026-08-31') $$,
  'Run uses the requested owner-local day and three completed calendar months'
);
select results_eq(
  $$ select summary #>> '{markers,public_portfolio,current}', summary #>> '{markers,public_portfolio,target}'
     from (select public.get_v3_run('2026-09-02') summary) value $$,
  $$ values ('2', '3') $$,
  'Run counts only current qualified public portfolios against target three'
);
select results_eq(
  $$ select summary #>> '{markers,dsa_patterns,current}', summary #>> '{markers,dsa_patterns,covered}', summary #>> '{markers,dsa_patterns,target}'
     from (select public.get_v3_run('2026-09-02') summary) value $$,
  $$ values ('2', '3', '24') $$,
  'Run separates covered and mastered DSA patterns against target 24'
);
select results_eq(
  $$ select summary #>> '{markers,mock_interviews,current}', summary #>> '{markers,mock_interviews,target}'
     from (select public.get_v3_run('2026-09-02') summary) value $$,
  $$ values ('2', '10') $$,
  'Run counts only explicitly labelled completed mock-interview drills'
);
select results_eq(
  $$ select summary #>> '{markers,application_conversion,current}', summary #>> '{markers,application_conversion,numerator}', summary #>> '{markers,application_conversion,denominator}', summary #>> '{markers,application_conversion,target}'
     from (select public.get_v3_run('2026-09-02') summary) value $$,
  $$ values ('66.7', '2', '3', '25') $$,
  'Run derives first-round conversion from submitted applications and conservative stages'
);
select results_eq(
  $$ select summary #>> '{markers,referral_conversations,current}', summary #>> '{markers,referral_conversations,target}'
     from (select public.get_v3_run('2026-09-02') summary) value $$,
  $$ values ('2', '12') $$,
  'Run counts distinct people with a completed contact commitment'
);
select is(
  (select string_agg(point ->> 'value', ',' order by point ->> 'month')
   from jsonb_array_elements(public.get_v3_run('2026-09-02') #> '{markers,public_portfolio,history}') point),
  '1,1,2',
  'public portfolio history is cumulative at completed month ends'
);
select is(
  (select string_agg(point ->> 'value', ',' order by point ->> 'month')
   from jsonb_array_elements(public.get_v3_run('2026-09-02') #> '{markers,dsa_patterns,history}') point),
  '1,1,2',
  'DSA mastery history uses the final review date'
);
select is(
  (select string_agg(point ->> 'value', ',' order by point ->> 'month')
   from jsonb_array_elements(public.get_v3_run('2026-09-02') #> '{markers,mock_interviews,history}') point),
  '1,1,2',
  'mock-interview history uses immutable completion dates'
);
select is(
  (select string_agg(coalesce(point ->> 'value', 'null'), ',' order by point ->> 'month')
   from jsonb_array_elements(public.get_v3_run('2026-09-02') #> '{markers,application_conversion,history}') point),
  '100.0,0.0,100.0',
  'conversion history uses the three completed submission cohorts'
);
select is(
  (select string_agg(point ->> 'value', ',' order by point ->> 'month')
   from jsonb_array_elements(public.get_v3_run('2026-09-02') #> '{markers,referral_conversations,history}') point),
  '1,1,2',
  'referral history counts each person from their first completed contact'
);
select ok(
  (public.get_v3_run('2026-09-02') #>> '{markers,public_portfolio,history_ready}')::boolean
    and (public.get_v3_run('2026-09-02') #>> '{markers,dsa_patterns,history_ready}')::boolean
    and (public.get_v3_run('2026-09-02') #>> '{markers,mock_interviews,history_ready}')::boolean
    and (public.get_v3_run('2026-09-02') #>> '{markers,application_conversion,history_ready}')::boolean
    and (public.get_v3_run('2026-09-02') #>> '{markers,referral_conversations,history_ready}')::boolean,
  'Run exposes trends only when all three completed months have usable history'
);
select ok(
  (select bool_and(jsonb_array_length(marker.value -> 'history') = 3)
   from jsonb_each(public.get_v3_run('2026-09-02') -> 'markers') marker),
  'every Run marker has exactly three bounded history points'
);

select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","client_id":"connected-oauth-client"}', true);
select throws_ok(
  $$ select public.get_v3_run('2026-09-02') $$,
  '42501',
  'profile not found',
  'connected OAuth clients cannot use the first-party Run read directly'
);
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"92000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select ok(
  not (public.get_v3_run('2026-09-02') #>> '{markers,public_portfolio,history_ready}')::boolean
    and (public.get_v3_run('2026-09-02') #>> '{markers,public_portfolio,current}')::integer = 1
    and public.get_v3_run('2026-09-02') #> '{markers,application_conversion,current}' = 'null'::jsonb,
  'a newer owner sees current values but no misleading three-month trend'
);

select * from finish();
rollback;
