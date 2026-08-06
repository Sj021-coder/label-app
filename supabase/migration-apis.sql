-- ============================================================
-- MIGRATION — Live APIs: Spotify/YouTube scoring automation + News
-- Run this AFTER migration-pillar234.sql, in Supabase SQL Editor.
-- ============================================================

-- 1. Artist ID mapping (needed to know WHICH Spotify/YouTube artist
--    corresponds to each row) + last-seen values to compute deltas
alter table artists add column if not exists spotify_id text;
alter table artists add column if not exists youtube_channel_id text;
alter table artists add column if not exists last_spotify_popularity integer;
alter table artists add column if not exists last_youtube_view_count bigint;
alter table artists add column if not exists last_synced_at timestamptz;

-- 2. News table — real articles pulled per artist
create table if not exists artist_news (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  title text not null,
  url text not null,
  source text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  reviewed boolean not null default false, -- has admin looked at this for a possible Culture event / pick'em?
  unique(artist_id, url)
);

alter table artist_news enable row level security;
create policy "news readable by all" on artist_news for select using (true);
-- Only the scheduled function (using the service role key, which bypasses RLS) writes here.
-- No insert policy needed for regular users.

-- ============================================================
-- NOTES
-- - spotify_id / youtube_channel_id start NULL for all 100 artists.
--   Use the new Admin "ID Mapping" tool to search and assign them —
--   the sync job skips any artist without an ID set.
-- - The daily sync function needs the SUPABASE_SERVICE_ROLE_KEY
--   (Project Settings > API > service_role, NOT the anon key) to
--   write scores/news without a logged-in user session.
-- ============================================================
