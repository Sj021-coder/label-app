-- ============================================================
-- MIGRATION — Pillars 2, 3 (remainder), 4: Better Scoring,
-- Rules for Engagement, and Formats (Season foundation + Pick'em)
-- Run this AFTER migration-pillar1.sql, in Supabase SQL Editor.
-- ============================================================

-- ---------------------------------------------------------
-- PILLAR 2 — Better Scoring: category-weighted composite
-- ---------------------------------------------------------
alter table artists add column if not exists momentum_score integer not null default 0;
alter table artists add column if not exists performance_score integer not null default 0;
alter table artists add column if not exists activity_score integer not null default 0;
alter table artists add column if not exists culture_score integer not null default 0;
alter table artists add column if not exists value integer; -- market price, stub = cost until live automation exists

update artists set value = cost where value is null;

alter table score_events add column if not exists category text; -- 'momentum' | 'performance' | 'activity' | 'culture'

-- ---------------------------------------------------------
-- PILLAR 4 — Formats: Seasons foundation
-- ---------------------------------------------------------
create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

alter table score_events add column if not exists season_id uuid references seasons(id);

-- Seed the current rolling-quarter season if none exists yet
insert into seasons (name, start_date, end_date, is_active)
select '2026 Q3', '2026-07-01', '2026-09-30', true
where not exists (select 1 from seasons where is_active = true);

alter table seasons enable row level security;
create policy "seasons readable by all" on seasons for select using (true);

-- ---------------------------------------------------------
-- PILLAR 3 (remainder) — Transfers, Captain, banked swaps
-- ---------------------------------------------------------
alter table profiles add column if not exists captain_artist_id uuid references artists(id);
alter table profiles add column if not exists free_transfers integer not null default 1;
alter table profiles add column if not exists last_transfer_refresh date not null default current_date;
alter table profiles add column if not exists penalty_points integer not null default 0;

create policy "users update own profile" on profiles for update using (auth.uid() = id);

-- ---------------------------------------------------------
-- Composite view: score + captain bonus + penalty = total
-- (replaces the old flat "leaderboard" view from schema.sql)
-- ---------------------------------------------------------
drop view if exists leaderboard;
create or replace view user_totals as
select
  p.id as user_id,
  p.username,
  p.captain_artist_id,
  p.free_transfers,
  p.penalty_points,
  coalesce(sum(a.score), 0) as base_score,
  coalesce(sum(case when a.id = p.captain_artist_id then a.score else 0 end), 0) as captain_bonus,
  coalesce(sum(a.score), 0)
    + coalesce(sum(case when a.id = p.captain_artist_id then a.score else 0 end), 0)
    - p.penalty_points as total_score,
  count(re.artist_id) as roster_size
from profiles p
left join roster_entries re on re.user_id = p.id
left join artists a on a.id = re.artist_id
group by p.id, p.username, p.captain_artist_id, p.free_transfers, p.penalty_points;

-- ---------------------------------------------------------
-- PILLAR 4 — Formats: Pick'em (QCM predictions)
-- ---------------------------------------------------------
create table if not exists predictions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  option_a text not null,
  option_b text not null,
  artist_a_id uuid references artists(id),
  artist_b_id uuid references artists(id),
  correct_option text, -- 'A' | 'B', null until resolved
  closes_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists prediction_picks (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references predictions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  chosen_option text not null, -- 'A' | 'B'
  created_at timestamptz not null default now(),
  unique(prediction_id, user_id)
);

alter table profiles add column if not exists pickem_score integer not null default 0;

alter table predictions enable row level security;
alter table prediction_picks enable row level security;

create policy "predictions readable by all" on predictions for select using (true);
create policy "authenticated users can create predictions" on predictions for insert with check (auth.uid() is not null);
create policy "authenticated users can resolve predictions" on predictions for update using (auth.uid() is not null);

create policy "picks readable by all" on prediction_picks for select using (true);
create policy "users insert own pick" on prediction_picks for insert with check (auth.uid() = user_id);

-- ============================================================
-- NOTES
-- - "custom" scoring events now require a category to be chosen
--   in the Admin form (momentum/performance/activity/culture).
-- - artists.score is now COMPUTED as a weighted composite
--   (Momentum 40% + Performance 30% + Activity 20% + Culture 10%)
--   by the /api/score-event route — it is no longer a simple
--   running sum of raw deltas.
-- - `value` is a stub (= cost) until live Spotify/YouTube
--   automation exists to make it fluctuate for real.
-- - Season reset (locking a season, starting a new one) is a
--   manual admin action for now, not automated — no cron
--   infrastructure exists yet.
-- ============================================================
