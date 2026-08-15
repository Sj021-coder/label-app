-- ============================================================
-- MIGRATION — Artist photos (from Spotify)
-- Safe: only adds a column. Run in Supabase SQL Editor.
-- ============================================================
alter table artists add column if not exists image_url text;
