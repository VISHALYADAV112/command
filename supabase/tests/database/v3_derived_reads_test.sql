begin;

select plan(38);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_settings'
      and column_name = 'weekly_application_target'
  ),
  'settings store the approved weekly application target'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_settings'
      and column_name = 'weekly_people_contact_target'
  ),
  'settings store the approved weekly people-contact target'
);
select ok(
  has_function_privilege(
    'authenticated', 'public.get_v3_due(date,text,text,integer,integer)', 'execute'
  ),
  'authenticated users may query the bounded Due read'
);
select ok(
  has_function_privilege('authenticated', 'public.get_v3_today(date,integer)', 'execute'),
  'authenticated users may query the Today summary'
);
select ok(
  has_function_privilege('authenticated', 'public.get_v3_week(date)', 'execute'),
  'authenticated users may query the Week summary'
);
select ok(
  has_function_privilege(
    'authenticated', 'public.get_v3_readiness_inputs(date,date,integer)', 'execute'
  ),
  'authenticated users may query bounded readiness inputs'
);
select ok(
  not has_function_privilege(
    'anon', 'public.get_v3_due(date,text,text,integer,integer)', 'execute'
  ),
  'anonymous users cannot query Due'
);
select ok(
  not has_function_privilege('anon', 'public.get_v3_today(date,integer)', 'execute'),
  'anonymous users cannot query Today'
);
select ok(
  not has_function_privilege('anon', 'public.get_v3_week(date)', 'execute'),
  'anonymous users cannot query Week'
);
select ok(
  not has_function_privilege(
    'anon', 'public.get_v3_readiness_inputs(date,date,integer)', 'execute'
  ),
  'anonymous users cannot query readiness inputs'
);

set local session_replication_role = replica;
insert into public.profiles (id, email, timezone) values
  ('11111111-1111-4111-8111-111111111111', 'one-reads@example.test', 'Asia/Kolkata'),
  ('22222222-2222-4222-8222-222222222222', 'two-reads@example.test', 'Asia/Kolkata');
set local session_replication_role = origin;

insert into public.user_settings (
  user_id, node_floor_minutes, dsa_floor_minutes, math_floor_minutes,
  node_weekly_minutes, dsa_weekly_minutes, math_weekly_minutes,
  weekly_application_target, weekly_people_contact_target
) values (
  '11111111-1111-4111-8111-111111111111',
  30, 60, 30, 210, 420, 210, 20, 3
);

insert into public.daily_logs (
  user_id, day, node_minutes, dsa_minutes, math_minutes
) values (
  '11111111-1111-4111-8111-111111111111', '2026-08-31', 40, 70, 20
);

insert into public.entity_types (
  id, user_id, type_key, singular_name, plural_name, allowed_commitment_kinds
) values
  (
    '33333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    'application', 'Application', 'Applications',
    array['follow-up', 'deadline']::text[]
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    '11111111-1111-4111-8111-111111111111',
    'person', 'Person', 'People', array['contact']::text[]
  ),
  (
    '45454545-4545-4545-8545-454545454545',
    '22222222-2222-4222-8222-222222222222',
    'application', 'Application', 'Applications', array['deadline']::text[]
  );

insert into public.entities (
  id, user_id, entity_type_id, title, fields, schema_version, archived_at
) values
  (
    '55555555-5555-4555-8555-555555555555',
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    'Active application', '{}'::jsonb, 1, null
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444444',
    'Active person', '{}'::jsonb, 1, null
  ),
  (
    '67676767-6767-4767-8767-676767676767',
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    'Archived application', '{}'::jsonb, 1, now()
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    '22222222-2222-4222-8222-222222222222',
    '45454545-4545-4545-8545-454545454545',
    'Foreign application', '{}'::jsonb, 1, null
  );

insert into public.commitments (
  id, user_id, entity_id, kind, action, due_on,
  state, outcome, completed_at, origin_source
) values
  (
    '81818181-8181-4181-8181-818181818181',
    '11111111-1111-4111-8111-111111111111',
    '55555555-5555-4555-8555-555555555555',
    'deadline', 'Overdue deadline', '2026-08-30',
    'open', null, null, 'ui'
  ),
  (
    '82828282-8282-4282-8282-828282828282',
    '11111111-1111-4111-8111-111111111111',
    '66666666-6666-4666-8666-666666666666',
    'contact', 'Contact today', '2026-08-31',
    'open', null, null, 'ui'
  ),
  (
    '83838383-8383-4383-8383-838383838383',
    '11111111-1111-4111-8111-111111111111',
    '55555555-5555-4555-8555-555555555555',
    'follow-up', 'Follow up this week', '2026-09-02',
    'open', null, null, 'ui'
  ),
  (
    '84848484-8484-4484-8484-848484848484',
    '11111111-1111-4111-8111-111111111111',
    '55555555-5555-4555-8555-555555555555',
    'deadline', 'Future deadline', '2026-09-10',
    'open', null, null, 'ui'
  ),
  (
    '85858585-8585-4585-8585-858585858585',
    '11111111-1111-4111-8111-111111111111',
    '55555555-5555-4555-8555-555555555555',
    'deadline', 'Completed this week', '2026-08-31',
    'completed', 'Done', '2026-08-31T12:00:00+05:30', 'ui'
  ),
  (
    '86868686-8686-4686-8686-868686868686',
    '11111111-1111-4111-8111-111111111111',
    '55555555-5555-4555-8555-555555555555',
    'follow-up', 'Cancelled this week', '2026-09-01',
    'cancelled', 'No longer needed', null, 'ui'
  ),
  (
    '87878787-8787-4787-8787-878787878787',
    '11111111-1111-4111-8111-111111111111',
    '67676767-6767-4767-8767-676767676767',
    'deadline', 'Archived overdue', '2026-08-29',
    'open', null, null, 'ui'
  ),
  (
    '88888888-8888-4888-8888-888888888888',
    '22222222-2222-4222-8222-222222222222',
    '77777777-7777-4777-8777-777777777777',
    'deadline', 'Foreign overdue', '2026-08-29',
    'open', null, null, 'ui'
  );

insert into public.activity_events (
  user_id, entity_id, commitment_id, event_type, payload,
  source, idempotency_key, occurred_at
) values
  (
    '11111111-1111-4111-8111-111111111111',
    '55555555-5555-4555-8555-555555555555', null,
    'application.submitted', '{}'::jsonb, 'ui', 'read-application-submitted',
    '2026-08-31T09:00:00+05:30'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    '66666666-6666-4666-8666-666666666666', null,
    'person.contacted', '{}'::jsonb, 'ui', 'read-person-contacted',
    '2026-08-31T10:00:00+05:30'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    '55555555-5555-4555-8555-555555555555',
    '86868686-8686-4686-8686-868686868686',
    'commitment.cancelled', '{}'::jsonb, 'ui', 'read-commitment-cancelled',
    '2026-08-31T11:00:00+05:30'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '77777777-7777-4777-8777-777777777777', null,
    'application.submitted', '{}'::jsonb, 'ui', 'foreign-application-submitted',
    '2026-08-31T09:00:00+05:30'
  );

do $$
begin
  perform public.create_agent_proposal(
    '11111111-1111-4111-8111-111111111111', 'read-client', 'capture',
    '33333333-3333-4333-8333-333333333333', null, null,
    '{"title":"Pending application","fields":{},"schema_version":1}'::jsonb,
    null, 'read-pending-proposal', null
  );
  perform public.create_agent_proposal(
    '11111111-1111-4111-8111-111111111111', 'read-client', 'capture',
    '33333333-3333-4333-8333-333333333333', null, null,
    '{"title":"Approved application","fields":{},"schema_version":1}'::jsonb,
    null, 'read-approved-proposal', null
  );
  perform public.create_agent_proposal(
    '11111111-1111-4111-8111-111111111111', 'read-client', 'capture',
    '33333333-3333-4333-8333-333333333333', null, null,
    '{"title":"Rejected application","fields":{},"schema_version":1}'::jsonb,
    null, 'read-rejected-proposal', null
  );
end;
$$;

set local session_replication_role = replica;
update public.agent_proposals
set created_at = case idempotency_key
  when 'read-pending-proposal' then '2026-08-31T09:00:00+05:30'::timestamptz
  when 'read-approved-proposal' then '2026-09-01T09:00:00+05:30'::timestamptz
  when 'read-rejected-proposal' then '2026-09-03T09:00:00+05:30'::timestamptz
end
where idempotency_key in (
  'read-pending-proposal', 'read-approved-proposal', 'read-rejected-proposal'
);
set local session_replication_role = origin;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select results_eq(
  $$
    select commitment_id::text
    from public.get_v3_due('2026-08-31', 'all', null, 50, 0)
  $$,
  $$
    values
      ('81818181-8181-4181-8181-818181818181'),
      ('82828282-8282-4282-8282-828282828282'),
      ('83838383-8383-4383-8383-838383838383'),
      ('84848484-8484-4484-8484-848484848484')
  $$,
  'Due returns only active, open, owned commitments in stable date order'
);
select results_eq(
  $$
    select due_status
    from public.get_v3_due('2026-08-31', 'all', null, 3, 0)
  $$,
  $$ values ('overdue'), ('today'), ('upcoming') $$,
  'Due derives temporal status without storing overdue state'
);
select is(
  (select count(*)::integer from public.get_v3_due('2026-08-31', 'overdue', null, 50, 0)),
  1,
  'the overdue window is derived from open due dates'
);
select is(
  (select count(*)::integer from public.get_v3_due('2026-08-31', 'today', null, 50, 0)),
  1,
  'the Today due window contains only the selected date'
);
select is(
  (select count(*)::integer from public.get_v3_due('2026-08-31', 'week', null, 50, 0)),
  2,
  'the week window ends on Sunday'
);
select is(
  (select count(*)::integer from public.get_v3_due('2026-08-31', 'all', 'application', 50, 0)),
  3,
  'Due filters by registry type key'
);
select is(
  (select count(*)::integer from public.get_v3_due('2026-08-31', 'all', null, 2, 0)),
  2,
  'Due applies its requested result bound'
);
select throws_ok(
  $$ select * from public.get_v3_due('2026-08-31', 'unsafe', null, 50, 0) $$,
  '22023',
  'invalid due window',
  'Due rejects unrecognized windows'
);
select is(
  public.get_v3_today('2026-08-31', 2) ->> 'day',
  '2026-08-31',
  'Today uses the requested local date'
);
select results_eq(
  $$
    select summary ->> 'overdue_count', summary #>> '{lead,commitment_id}'
    from (select public.get_v3_today('2026-08-31', 2) summary) value
  $$,
  $$ values ('1', '81818181-8181-4181-8181-818181818181') $$,
  'Today exposes the overdue count and lead exception'
);
select results_eq(
  $$
    select summary #>> '{floors,node,minutes}', summary #>> '{floors,node,target}',
      summary #>> '{floors,node,met}', summary #>> '{floors,math,met}'
    from (select public.get_v3_today('2026-08-31', 2) summary) value
  $$,
  $$ values ('40', '30', 'true', 'false') $$,
  'Today derives settings-aware status for only the three practice floors'
);
select results_eq(
  $$
    select summary #>> '{weekly,applications_submitted}',
      summary #>> '{weekly,application_target}',
      summary #>> '{weekly,people_contacted}',
      summary #>> '{weekly,people_target}'
    from (select public.get_v3_today('2026-08-31', 2) summary) value
  $$,
  $$ values ('1', '20', '1', '3') $$,
  'Today derives weekly outcome progress from events and current settings'
);
select is(
  jsonb_array_length(public.get_v3_today('2026-08-31', 2) -> 'queue'),
  2,
  'Today bounds its short commitment queue'
);
select is(
  (public.get_v3_today('2026-08-31', 2) ->> 'pending_proposals')::integer,
  3,
  'Today exposes only the pending proposal indicator count'
);
select results_eq(
  $$
    select summary ->> 'week_start', summary ->> 'week_end'
    from (select public.get_v3_week('2026-09-02') summary) value
  $$,
  $$ values ('2026-08-31', '2026-09-06') $$,
  'Week normalizes any supplied date to Monday through Sunday'
);
select is(
  jsonb_array_length(public.get_v3_week('2026-08-31') -> 'days'),
  7,
  'Week always returns a seven-day structure'
);
select results_eq(
  $$
    select summary #>> '{practice,node,minutes}', summary #>> '{practice,node,target}',
      summary #>> '{practice,dsa,minutes}', summary #>> '{practice,math,minutes}'
    from (select public.get_v3_week('2026-08-31') summary) value
  $$,
  $$ values ('40', '210', '70', '20') $$,
  'Week aggregates practice totals against current budgets'
);
select results_eq(
  $$
    select summary ->> 'applications_submitted', summary ->> 'application_target',
      summary ->> 'people_contacted', summary ->> 'people_target'
    from (select public.get_v3_week('2026-08-31') summary) value
  $$,
  $$ values ('1', '20', '1', '3') $$,
  'Week exposes the approved weekly outcome targets and progress'
);
select results_eq(
  $$
    select summary #>> '{commitments,completed}', summary #>> '{commitments,cancelled}'
    from (select public.get_v3_week('2026-08-31') summary) value
  $$,
  $$ values ('1', '1') $$,
  'Week derives completed and cancelled commitment inputs'
);
select results_eq(
  $$
    select event_type, entity_type_key, event_count::integer, distinct_entity_count::integer
    from public.get_v3_readiness_inputs('2026-08-31', '2026-08-31', 100)
  $$,
  $$
    values
      ('application.submitted', 'application', 1, 1),
      ('commitment.cancelled', 'application', 1, 1),
      ('person.contacted', 'person', 1, 1)
  $$,
  'readiness inputs aggregate only the owner''s typed activity'
);
select is(
  (select count(*)::integer
    from public.get_v3_readiness_inputs('2026-08-31', '2026-08-31', 1)),
  1,
  'readiness inputs honor their result bound'
);
select throws_ok(
  $$ select * from public.get_v3_readiness_inputs('2026-01-01', '2027-02-01', 100) $$,
  '22023',
  'invalid readiness range',
  'readiness inputs reject unbounded date ranges'
);

select lives_ok(
  $$
    select public.decide_agent_proposal(
      (select id from public.agent_proposals where idempotency_key = 'read-approved-proposal'),
      'approve', null, null, 'Approved for Week coverage'
    )
  $$,
  'Week fixture approves a proposal through the review gate'
);
select lives_ok(
  $$
    select public.decide_agent_proposal(
      (select id from public.agent_proposals where idempotency_key = 'read-rejected-proposal'),
      'reject', null, null, 'Rejected for Week coverage'
    )
  $$,
  'Week fixture rejects a proposal through the review gate'
);

reset role;
set local session_replication_role = replica;
update public.agent_proposals
set decided_at = case idempotency_key
  when 'read-approved-proposal' then '2026-09-02T09:00:00+05:30'::timestamptz
  when 'read-rejected-proposal' then '2026-09-04T09:00:00+05:30'::timestamptz
end
where idempotency_key in ('read-approved-proposal', 'read-rejected-proposal');
set local session_replication_role = origin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select ok(
  (
    select bool_and(
      (day_row ->> 'is_future')::boolean
        = ((day_row ->> 'day')::date > (now() at time zone 'Asia/Kolkata')::date)
    )
    from jsonb_array_elements(public.get_v3_week('2026-08-31') -> 'days') day_row
  ),
  'Week derives future-day flags from the owner''s Asia/Kolkata local date'
);
select is(
  (public.get_v3_week('2026-08-31') #>> '{commitments,missed}')::integer,
  (
    select count(*)::integer
    from public.commitments commitment
    join public.entities entity
      on entity.user_id = commitment.user_id and entity.id = commitment.entity_id
    where commitment.user_id = '11111111-1111-4111-8111-111111111111'
      and commitment.state = 'open'
      and entity.archived_at is null
      and commitment.due_on between '2026-08-31'
        and least('2026-09-06'::date, (now() at time zone 'Asia/Kolkata')::date - 1)
  ),
  'Week counts only active-record commitments missed before the local current day'
);
select results_eq(
  $$
    select summary #>> '{proposals,proposed}', summary #>> '{proposals,approved}',
      summary #>> '{proposals,rejected}'
    from (select public.get_v3_week('2026-08-31') summary) value
  $$,
  $$ values ('3', '1', '1') $$,
  'Week exposes proposal creation and reviewed decision activity'
);
select ok(
  jsonb_array_length(public.get_v3_week('1900-01-01') -> 'days') = 7
    and (public.get_v3_week('1900-01-01') #>> '{practice,node,minutes}')::integer = 0
    and (public.get_v3_week('1900-01-01') #>> '{practice,dsa,minutes}')::integer = 0
    and (public.get_v3_week('1900-01-01') #>> '{practice,math,minutes}')::integer = 0
    and (public.get_v3_week('1900-01-01') ->> 'applications_submitted')::integer = 0
    and (public.get_v3_week('1900-01-01') ->> 'people_contacted')::integer = 0,
  'Week keeps its bounded seven-day structure when the week has no activity'
);

select * from finish();
rollback;
