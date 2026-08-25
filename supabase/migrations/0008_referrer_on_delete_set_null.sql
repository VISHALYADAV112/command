-- Command — person deletes must not strand applications.
-- referrer_id carried no ON DELETE action, so deleting a person who was a
-- referrer failed remotely with an FK violation while the UI had already
-- removed them optimistically. Null it out instead.

alter table public.job_applications
  drop constraint job_applications_referrer_id_fkey,
  add foreign key (referrer_id) references public.people (id)
    on delete set null;
