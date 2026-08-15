-- ============================================================
-- MIGRATION — Release Radar: upcoming releases + friendlier event labels
-- Run this AFTER migration-releases.sql, in Supabase SQL Editor.
-- ============================================================

create table if not exists upcoming_releases (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  title text not null,
  scheduled_at timestamptz not null,
  source text not null default 'youtube_premiere',
  video_url text,
  detected_at timestamptz not null default now(),
  unique(artist_id, title, scheduled_at)
);

alter table upcoming_releases enable row level security;
create policy "upcoming releases readable by all" on upcoming_releases for select using (true);
-- Only the scheduled sync function (service_role key) writes here.

-- ============================================================
-- NOTES
-- - Detected via YouTube's "eventType=upcoming" search, which finds
--   scheduled premiere videos artists use to hype a release before
--   it's actually out — this is a real, free "announced" signal.
-- - Once the scheduled date passes, an entry naturally becomes
--   "past" from the app's point of view (filtered by scheduled_at).
-- - This does NOT catch every announcement (only ones using YouTube
--   Premiere), but it's the only reliable free source for genuine
--   pre-release signal.
-- ============================================================
