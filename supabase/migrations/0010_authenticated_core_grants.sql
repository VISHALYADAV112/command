-- RLS policies decide which owner rows are visible, but table privileges must
-- first allow the authenticated role to attempt each operation.

revoke all on table
  public.profiles,
  public.user_settings,
  public.daily_logs,
  public.learning_items,
  public.people,
  public.job_applications,
  public.projects,
  public.ideas
from anon;

grant select, insert, update, delete on table
  public.profiles,
  public.user_settings,
  public.daily_logs,
  public.learning_items,
  public.people,
  public.job_applications,
  public.projects,
  public.ideas
to authenticated;
