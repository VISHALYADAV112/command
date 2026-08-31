begin;

select plan(35);

select has_table('public', 'v3_legacy_entity_map', 'legacy entity id map exists');
select has_table('public', 'v3_legacy_commitment_map', 'legacy commitment id map exists');
select ok(
  not has_table_privilege('authenticated', 'public.v3_legacy_entity_map', 'select'),
  'legacy entity maps are operational data, not a browser write surface'
);
select ok(
  has_function_privilege('service_role', 'public.v3_migration_backfill(uuid)', 'execute'),
  'the backfill runner is service-role only'
);
select ok(
  not has_function_privilege('authenticated', 'public.v3_migration_backfill(uuid)', 'execute'),
  'authenticated users cannot run the backfill'
);
set local session_replication_role = replica;
insert into public.profiles (id, email, timezone) values
  ('11111111-1111-4111-8111-111111111111', 'backfill@example.test', 'Asia/Kolkata');
set local session_replication_role = origin;
select public.seed_default_entity_types('11111111-1111-4111-8111-111111111111');

select ok(
  (select schema_version = 2 and jsonb_array_length(field_schema) = 14
   from public.entity_types where user_id = '11111111-1111-4111-8111-111111111111' and type_key = 'application'),
  'the application seed is finalized at schema version 2'
);

insert into public.daily_logs (
  id, user_id, day, meditation, gym, diet, node_minutes, dsa_minutes,
  math_minutes, job_hunt_minutes, note, created_at, updated_at
) values (
  '01010101-0101-4101-8101-010101010101',
  '11111111-1111-4111-8111-111111111111', '2026-08-31', true, false, 'on_track',
  31, 62, 33, 77, 'historical minutes stay minutes',
  '2026-08-31T01:00:00+00', '2026-08-31T02:00:00+00'
);

insert into public.people (
  id, user_id, name, company, email, linkedin_url, how_known, status,
  last_contacted_on, next_follow_up_on, notes, created_at, updated_at
) values (
  '02020202-0202-4202-8202-020202020202',
  '11111111-1111-4111-8111-111111111111', 'Ada Lovelace', 'Analytical Engines',
  'ada@example.test', 'https://linkedin.com/in/ada', 'alumni', 'talking',
  '2026-08-29', '2026-09-03', 'A useful introduction',
  '2026-08-20T01:00:00+00', '2026-08-30T02:00:00+00'
);

insert into public.job_applications (
  id, user_id, company, role, lane, channel, status, referrer_id, ctc_lpa,
  next_action, follow_up_on, window_closes_on, job_url, resume_version,
  resume_drive_url, notes, applied_on, has_referral, created_at, updated_at
) values (
  '03030303-0303-4303-8303-030303030303',
  '11111111-1111-4111-8111-111111111111', 'Acme', 'Staff Engineer', 'sde',
  'india_product', 'applied', '02020202-0202-4202-8202-020202020202', 42.5,
  'Send a focused follow-up', '2026-09-02', '2026-09-05',
  'https://example.test/jobs/acme', 'resume-2026-08',
  'https://drive.google.com/resume', 'Historical application', '2026-08-28',
  true, '2026-08-21T01:00:00+00', '2026-08-30T03:00:00+00'
);

insert into public.projects (
  id, user_id, name, project_type, status, client, payment_status, amount,
  currency, is_public, deadline_on, repo_url, demo_url, drive_folder_url,
  next_action, content_markdown, created_at, updated_at
) values (
  '04040404-0404-4404-8404-040404040404',
  '11111111-1111-4111-8111-111111111111', 'Command v3', 'portfolio', 'active',
  null, 'na', null, 'INR', false, '2026-09-10',
  'https://github.com/example/command', null, null, 'Ship the migration slice',
  '# Keep the source content', '2026-08-22T01:00:00+00', '2026-08-30T04:00:00+00'
);

insert into public.learning_items (
  id, user_id, concept, stack, track, item_type, confidence, difficulty,
  next_review_on, last_reviewed_on, mastery_hits, source_url, content_markdown,
  created_at, updated_at
) values (
  '05050505-0505-4505-8505-050505050505',
  '11111111-1111-4111-8111-111111111111', 'B-tree indexes', 'brain', 'dsa',
  'concept', 4, 'medium', '2026-09-04', '2026-08-27', 3,
  'https://postgresql.org/docs', 'Recall details',
  '2026-08-23T01:00:00+00', '2026-08-30T05:00:00+00'
);

insert into public.ideas (
  id, user_id, idea, problem, target_market, monetization, status, next_action,
  created_at, updated_at
) values (
  '06060606-0606-4606-8606-060606060606',
  '11111111-1111-4111-8111-111111111111', 'A calm inbox', 'Too many noisy alerts',
  'Independent builders', 'Subscription', 'captured', 'Interview three builders',
  '2026-08-24T01:00:00+00', '2026-08-30T06:00:00+00'
);

insert into public.integration_links (
  user_id, provider, entity_type, entity_id, external_type, external_id,
  external_url, idempotency_key, fingerprint
) values (
  '11111111-1111-4111-8111-111111111111', 'google', 'application_deadline',
  '03030303-0303-4303-8303-030303030303', 'calendar_event', 'g-acme',
  'https://calendar.google.com/event/g-acme', 'calendar-acme', 'calendar-acme'
);

select is(
  (select count(*)::integer from public.v3_migration_preflight('11111111-1111-4111-8111-111111111111')),
  0,
  'representative legacy rows pass the v2 mapping preflight'
);

select lives_ok(
  $$ select public.v3_migration_backfill('11111111-1111-4111-8111-111111111111') $$,
  'the first backfill succeeds'
);
select is(
  (select count(*)::integer from public.v3_legacy_entity_map
   where user_id = '11111111-1111-4111-8111-111111111111'), 5,
  'one stable entity map row exists for every source entity'
);
select is(
  (select count(*)::integer from public.entities
   where user_id = '11111111-1111-4111-8111-111111111111'), 5,
  'every source entity becomes one canonical entity'
);
select is(
  (select count(*)::integer from public.v3_legacy_commitment_map
   where user_id = '11111111-1111-4111-8111-111111111111'), 5,
  'all meaningful source dates become separate commitments'
);
select is(
  (select count(*)::integer from public.commitments
   where user_id = '11111111-1111-4111-8111-111111111111' and origin_source = 'migration'), 5,
  'migration commitments preserve their provenance'
);
select is(
  (select count(*)::integer from public.activity_events
   where user_id = '11111111-1111-4111-8111-111111111111' and source = 'migration'), 12,
  'entity, commitment, application, and contact provenance events are appended'
);
select is(
  (select fields ->> 'tag' from public.entities entity
   join public.v3_legacy_entity_map map on map.user_id = entity.user_id and map.entity_id = entity.id
   where map.source_table = 'ideas' and map.source_id = '06060606-0606-4606-8606-060606060606'),
  'idea',
  'ideas become note entities tagged idea'
);
select is(
  (select entity_type from public.integration_links where external_id = 'g-acme'),
  'commitment',
  'Calendar deadline links are relinked to commitments'
);
select is(
  (select entity_id from public.integration_links where external_id = 'g-acme'),
  (select commitment_id from public.v3_legacy_commitment_map where source_table = 'job_applications' and source_field = 'window_closes_on'),
  'Calendar relinking preserves the provider event and targets the mapped commitment'
);
select results_eq(
  $$ select relinkable::integer, relinked::integer, pending::integer
     from public.v3_migration_calendar_report('11111111-1111-4111-8111-111111111111') $$,
  $$ values (0, 1, 0) $$,
  'the Calendar report distinguishes relinked and pending links'
);
select is(
  (select job_hunt_minutes from public.daily_logs where id = '01010101-0101-4101-8101-010101010101'),
  77,
  'historical job-hunt minutes remain unchanged'
);
select is(
  public.v3_migration_legacy_json('11111111-1111-4111-8111-111111111111'),
  public.v3_migration_compatibility_json('11111111-1111-4111-8111-111111111111'),
  'full JSON compatibility export matches before and after'
);

select is(
  public.v3_migration_csv('11111111-1111-4111-8111-111111111111', 'before', 'job_applications'),
  public.v3_migration_csv('11111111-1111-4111-8111-111111111111', 'after', 'job_applications'),
  'application CSV compatibility export matches before and after'
);
select is(
  public.v3_migration_csv('11111111-1111-4111-8111-111111111111', 'before', 'people'),
  public.v3_migration_csv('11111111-1111-4111-8111-111111111111', 'after', 'people'),
  'people CSV compatibility export matches before and after'
);
select is(
  public.v3_migration_csv('11111111-1111-4111-8111-111111111111', 'before', 'projects'),
  public.v3_migration_csv('11111111-1111-4111-8111-111111111111', 'after', 'projects'),
  'project CSV compatibility export matches before and after'
);
select is(
  public.v3_migration_csv('11111111-1111-4111-8111-111111111111', 'before', 'learning_items'),
  public.v3_migration_csv('11111111-1111-4111-8111-111111111111', 'after', 'learning_items'),
  'learning CSV compatibility export matches before and after'
);
select is(
  public.v3_migration_csv('11111111-1111-4111-8111-111111111111', 'before', 'ideas'),
  public.v3_migration_csv('11111111-1111-4111-8111-111111111111', 'after', 'ideas'),
  'idea CSV compatibility export matches before and after'
);
select is(
  public.v3_migration_csv('11111111-1111-4111-8111-111111111111', 'before', 'daily_logs'),
  public.v3_migration_csv('11111111-1111-4111-8111-111111111111', 'after', 'daily_logs'),
  'daily-log CSV compatibility export matches before and after'
);

select lives_ok(
  $$ select public.v3_migration_backfill('11111111-1111-4111-8111-111111111111') $$,
  'the second backfill is idempotent'
);
select is(
  (select count(*)::integer from public.entities
   where user_id = '11111111-1111-4111-8111-111111111111'), 5,
  'the second backfill creates no duplicate entities'
);
select is(
  (select count(*)::integer from public.commitments
   where user_id = '11111111-1111-4111-8111-111111111111' and origin_source = 'migration'), 5,
  'the second backfill creates no duplicate commitments'
);
select is(
  (select count(*)::integer from public.activity_events
   where user_id = '11111111-1111-4111-8111-111111111111' and source = 'migration'), 12,
  'the second backfill creates no duplicate migration events'
);
select is(
  (select count(*)::integer from public.job_applications), 1,
  'legacy application rows remain intact'
);
select is(
  (select count(*)::integer from public.people), 1,
  'legacy people rows remain intact'
);
select is(
  (select count(*)::integer from public.projects), 1,
  'legacy project rows remain intact'
);
select is(
  (select count(*)::integer from public.learning_items), 1,
  'legacy learning rows remain intact'
);
select is(
  (select count(*)::integer from public.ideas), 1,
  'legacy idea rows remain intact'
);
select is(
  (select count(*)::integer from public.daily_logs), 1,
  'legacy daily-log rows remain intact'
);

rollback;
