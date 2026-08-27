-- Closes the "non-atomic dual-write" gap flagged in the pipeline audit:
-- every score change used to be TWO separate network calls from the sync
-- function (insert into score_events, then update artists). If the second
-- call ever failed after the first succeeded, the two would silently
-- diverge. A Postgres function's body runs as ONE transaction — if any
-- statement inside raises, everything inside rolls back together. Calling
-- this via a single supabase.rpc() call makes the whole write genuinely
-- atomic: either both happen, or neither does.
--
-- Deliberately dumb on purpose: all the real logic (anti-dominance
-- dampening, category weighting) still happens in daily-sync.mjs, in one
-- place, in JS. This function only takes the ALREADY-COMPUTED final values
-- and writes them together — so there's no scoring formula duplicated (and
-- no risk of it silently drifting) between JS and SQL.
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
  p_score integer
) returns void
language plpgsql
as $$
begin
  insert into score_events (artist_id, event_key, label, delta, category, season_id, created_by)
  values (p_artist_id, p_event_key, p_label, p_delta, p_category, p_season_id, null);

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
