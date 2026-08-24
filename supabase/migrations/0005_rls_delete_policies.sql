-- Command — RLS delete policies
-- Spec §9.2: every table carries auditable policies for all four operations.
-- Deletes are owner-scoped like the rest; cascades handle children.

create policy "profiles_delete_own" on public.profiles
  for delete using (id = auth.uid());

create policy "user_settings_delete_own" on public.user_settings
  for delete using (user_id = auth.uid());

create policy "daily_logs_delete_own" on public.daily_logs
  for delete using (user_id = auth.uid());

create policy "learning_items_delete_own" on public.learning_items
  for delete using (user_id = auth.uid());

create policy "people_delete_own" on public.people
  for delete using (user_id = auth.uid());

create policy "job_applications_delete_own" on public.job_applications
  for delete using (user_id = auth.uid());

create policy "projects_delete_own" on public.projects
  for delete using (user_id = auth.uid());

create policy "ideas_delete_own" on public.ideas
  for delete using (user_id = auth.uid());
