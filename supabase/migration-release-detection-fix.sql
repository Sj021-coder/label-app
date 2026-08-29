-- Companion to the release-detection fix in daily-sync.mjs: features now
-- get the same name-based dedupe releases already had (last_release_name),
-- so a feature can't re-fire just because its date sorted higher — it also
-- has to actually be a different track.
alter table artists add column if not exists last_feature_name text;
