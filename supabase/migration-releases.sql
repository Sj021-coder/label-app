-- ============================================================
-- MIGRATION — Automatic release detection
-- Run this AFTER migration-apis.sql, in Supabase SQL Editor.
-- ============================================================

alter table artists add column if not exists last_release_date date;
alter table artists add column if not exists last_release_name text;
alter table artists add column if not exists last_spotify_followers integer;
alter table artists add column if not exists last_youtube_subscribers integer;
alter table artists add column if not exists last_feature_date date;

-- ============================================================
-- NOTES
-- - The daily sync job checks, per mapped artist, fully automatically:
--   1. Spotify popularity delta -> Momentum
--   2. Spotify follower growth -> Momentum
--   3. YouTube view growth -> Momentum
--   4. YouTube subscriber growth -> Momentum
--   5. New album/single release -> Activity ("the boom moment")
--   6. New "appears on" credit (a feature on someone else's track) -> Activity
-- - None of the above require any manual admin input, once an artist
--   is mapped to their Spotify/YouTube IDs.
-- - Culture (viral moments, awards, controversy) has NO free automatic
--   data source anywhere — this stays manually logged, permanently,
--   not as a missing feature but as a real data-availability limit.
-- - First sync per artist just records the baseline (no event fires
--   retroactively for their existing back-catalog).
-- ============================================================
