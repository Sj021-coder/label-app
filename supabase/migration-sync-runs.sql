-- Engine observability: one row per daily-sync run (success or failure).
-- Lets the Admin health card answer "is the engine actually alive?" at a
-- glance instead of everyone hoping the twice-daily cron fired silently.
--
-- Safe to re-run: drops first in case a previous partial attempt created a
-- differently-shaped table (the same pattern that broke `teams`/`leagues`
-- earlier this project — `create table if not exists` silently no-ops on a
-- mismatched existing table). No successful writes exist yet, so dropping
-- is safe here too.
drop table if exists sync_runs cascade;

create table sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  duration_ms integer not null,
  success boolean not null,
  errors jsonb not null default '[]'::jsonb,
  results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index sync_runs_started_at_idx on sync_runs (started_at desc);

alter table sync_runs enable row level security;

-- Written only by the scheduled function (service_role key, bypasses RLS
-- anyway) — this policy exists so an admin can read it from the Admin page
-- through the normal authenticated client. No one else needs access.
create policy "Admins can read sync_runs"
  on sync_runs for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );
