-- A moving project without a concrete next action is a dead row. Keep done
-- projects exempt so their terminal history can remain concise.

alter table public.projects
  add constraint active_project_has_next_action
  check (
    status = 'done'
    or nullif(btrim(next_action), '') is not null
  ) not valid;
