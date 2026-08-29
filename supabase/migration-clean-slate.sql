-- Full reset after the release-detection audit found ~12% of Spotify
-- mappings pointing at the wrong artist (Blacko -> a Michigan country-trap
-- artist, Black M -> a UK rock band, etc). Every score, event, and
-- baseline is now potentially contaminated by a stranger's data, so this
-- clears it all and lets the engine re-baseline cleanly on the next run.
--
-- RUN THIS ONLY AFTER pasting the corrected artist IDs from the audit —
-- resetting first and re-mapping after would just contaminate the fresh
-- baseline with the same wrong data all over again.
--
-- Safe: no real users are actively relying on current standings yet
-- (pre-launch friend testing only). profiles.pickem_score is untouched —
-- Pick'em is a separate, already-correct system. Leaderboard totals
-- recompute automatically through the user_totals view, nothing to reset there.

-- 1. Wipe the event log and derived award/milestone tables.
delete from score_events;
delete from milestones;
delete from weekly_awards;

-- 2. Zero every artist's score entirely, and null every baseline "last
--    known value" column — nulling matters as much as zeroing: without
--    it, the FIRST sync after this reset would diff a fresh real number
--    against a stale pre-reset baseline and manufacture a huge fake delta
--    on day one. With every baseline null, the next run just re-baselines
--    silently (0 events, expected), and the run after that produces the
--    first genuinely real movement.
update artists set
  momentum_score = 0,
  performance_score = 0,
  activity_score = 0,
  culture_score = 0,
  score = 0,
  value = cost,
  value_reason = null,
  value_reason_at = null,
  last_spotify_popularity = null,
  last_spotify_followers = null,
  last_youtube_view_count = null,
  last_youtube_subscribers = null,
  last_deezer_fans = null,
  last_deezer_rank = null,
  last_release_date = null,
  last_release_name = null,
  last_feature_date = null,
  last_feature_name = null,
  last_synced_at = null;
