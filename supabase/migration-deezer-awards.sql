-- ============================================================
-- MIGRATION — Deezer signals, Milestones, Weekly Awards
-- Run this AFTER migration-value-check.sql, in Supabase SQL Editor.
-- ============================================================

-- 1. Deezer tracking (no API key needed — Deezer's public endpoints are open)
alter table artists add column if not exists deezer_id text;
alter table artists add column if not exists last_deezer_fans integer;
alter table artists add column if not exists last_deezer_rank integer;

-- 2. Milestones — round-number thresholds an artist's score has crossed
create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  threshold integer not null,
  reached_at timestamptz not null default now(),
  unique(artist_id, threshold)
);

alter table milestones enable row level security;
create policy "milestones readable by all" on milestones for select using (true);

-- 3. Weekly Awards — one row per award type per week, updated as the
--    week progresses (upserted, not re-inserted, so there's exactly one
--    current leader shown at any time)
create table if not exists weekly_awards (
  id uuid primary key default gen_random_uuid(),
  award_type text not null,
  artist_id uuid references artists(id) on delete cascade,
  week_start date not null,
  value numeric not null default 0,
  computed_at timestamptz not null default now(),
  unique(award_type, week_start)
);

alter table weekly_awards enable row level security;
create policy "weekly awards readable by all" on weekly_awards for select using (true);

-- ============================================================
-- NOTES
-- - Deezer's public API needs NO authentication key at all for
--   /search, /artist/{id} endpoints — genuinely free, zero signup.
-- - Google News RSS replaces the dropped Currents API — also needs
--   no key, just a URL per search term.
-- - Milestones fire once per threshold per artist (unique constraint
--   prevents re-firing) and are logged as a small culture-category
--   score_event, so they show up automatically in the existing
--   Roster/Radar feeds without new UI.
-- - Weekly Awards recompute every sync run but only ever hold ONE
--   current row per award per week (upsert), so it always reflects
--   the latest leader, not a growing history.
-- ============================================================
