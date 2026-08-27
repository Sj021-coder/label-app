-- Needed for the Pick'em page's live push: a Realtime subscription only
-- fires for tables actually in this publication. `artists` was added
-- earlier (migration-realtime-artists.sql); this adds `predictions` so the
-- Pick'em page refreshes the instant an admin resolves a question (sets
-- correct_option), not just when an artist's score changes.
alter publication supabase_realtime add table predictions;
