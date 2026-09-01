-- Two new, independent data sources being added to the engine:
--
-- 1. MusicBrainz — a FALLBACK for release detection, not a replacement.
--    Separate baseline columns (not shared with last_release_date/name)
--    on purpose: this only ever runs for an artist Spotify DIDN'T check
--    this cycle, so mixing baselines with Spotify's own tracking would
--    create false "new release" comparisons the first time either source
--    catches up to the other.
--
-- 2. kworb.net — real per-song stream counts (proven working, keyed by
--    the same Spotify ID already stored), enabling genuine streaming
--    milestones detected from real numbers, not only when press writes
--    about them.
alter table artists add column if not exists last_release_date_mb date;
alter table artists add column if not exists last_release_name_mb text;
alter table artists add column if not exists top_track_name text;
alter table artists add column if not exists top_track_streams bigint;
