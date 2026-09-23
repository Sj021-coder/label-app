-- CRITICAL FIX — this has been silently blocking every automated score
-- event since migration-atomic-score-event-created-by.sql was run.
--
-- That migration used `create or replace function apply_score_event_atomic(...)`
-- but with a DIFFERENT parameter list (12 params, not 11) than the
-- original (migration-atomic-score-event.sql). Postgres identifies a
-- function by its NAME + PARAMETER TYPES together — a different parameter
-- count is a different identity, so "or replace" created a SECOND
-- function instead of replacing the first. Both have coexisted since.
--
-- Every call from daily-sync-worker.mjs (which never names p_created_by)
-- has been failing with "Could not choose the best candidate function"
-- ever since — confirmed live in production on 2026-09-02, visible for the
-- first time only now because this is the first run that completed long
-- enough to reach and log those errors instead of being killed by the old
-- 60-second ceiling first.
--
-- Fix: drop the OLD 11-parameter version outright. The 12-parameter
-- version (p_created_by defaults to null) stays and keeps working
-- identically for every existing caller — nothing else changes.
drop function if exists apply_score_event_atomic(
  uuid, text, text, integer, text, uuid, integer, integer, integer, integer, integer
);
