-- Adds an optional p_created_by parameter to the atomic scoring function.
-- The engine (daily-sync.mjs) never passes it (defaults to null, meaning
-- "automated") — but the manual Admin scoring form needs to keep recording
-- WHICH admin made a hand-entered adjustment, same as it always did before
-- this function existed. Safe to re-run: adding a parameter with a default
-- doesn't break any existing caller.
create or replace function apply_score_event_atomic(
  p_artist_id uuid,
  p_event_key text,
  p_label text,
  p_delta integer,
  p_category text,
  p_season_id uuid,
  p_momentum_score integer,
  p_performance_score integer,
  p_activity_score integer,
  p_culture_score integer,
  p_score integer,
  p_created_by uuid default null
) returns void
language plpgsql
as $$
begin
  insert into score_events (artist_id, event_key, label, delta, category, season_id, created_by)
  values (p_artist_id, p_event_key, p_label, p_delta, p_category, p_season_id, p_created_by);

  update artists
  set
    momentum_score = p_momentum_score,
    performance_score = p_performance_score,
    activity_score = p_activity_score,
    culture_score = p_culture_score,
    score = p_score
  where id = p_artist_id;
end;
$$;
