-- ============================================================
-- MIGRATION — Pick'em stakes (odds/coefficient) + Radar explainability
-- Run this in Supabase SQL Editor. Safe: only adds columns / relaxes a
-- constraint, no data loss.
-- ============================================================

-- 1. Pick'em odds. Each prediction now carries a coefficient ("cote") the
--    admin sets when creating it. Win = +stake*(coefficient-1). Lose = -stake.
--    Stake itself is a fixed constant (PICKEM_STAKE in lib/gameRules.js) —
--    not per-question, so this is the only new column Pick'em needs.
alter table predictions add column if not exists coefficient numeric not null default 2.0;

-- 2. Value explainability. Today `artists.value` is recomputed silently every
--    sync run with no record of WHY. These two columns store a plain-language
--    reason (+ when) alongside every value change, so it's never a black box.
alter table artists add column if not exists value_reason text;
alter table artists add column if not exists value_reason_at timestamptz;

-- 3. Let artist_news hold GENERAL rap-news items (a site's whole feed, not
--    matched to one specific artist) — the "Actu rap" ticker on Radar.
--    Per-artist rows are unaffected; this only widens what's allowed.
alter table artist_news alter column artist_id drop not null;
