-- ============================================================
-- MIGRATION — Admin role lock + product analytics (events)
-- Run this in Supabase SQL Editor. Safe: only adds a column + a table.
-- ============================================================

-- 1. Admin role flag on profiles (everyone defaults to NON-admin)
alter table profiles add column if not exists is_admin boolean not null default false;

-- 2. Events table — lightweight first-party product analytics
--    (accounts created, rosters drafted, shares, and future custom events)
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  user_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table events enable row level security;

-- Anyone (including anonymous players) may LOG an event...
create policy "anyone can log an event" on events
  for insert with check (true);

-- ...but only admins may READ the analytics.
create policy "admins can read events" on events
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin)
  );

-- ============================================================
-- AFTER running this, make YOURSELF the admin with one line
-- (replace YOUR_PSEUDO with your exact in-game username):
--
--   update profiles set is_admin = true where username = 'YOUR_PSEUDO';
--
-- Until you do that, NOBODY can open /admin — that's intended.
-- ============================================================
