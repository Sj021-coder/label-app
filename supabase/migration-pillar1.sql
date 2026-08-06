-- ============================================================
-- MIGRATION — Pillar 1: Bigger Pool + budget/tier fields
-- Run this in Supabase SQL Editor (Project > SQL Editor > New query)
-- Safe to run on top of the existing schema.
-- ============================================================

-- 1. Add cost + tier fields to artists (S/A/B/C tiers, cost in Label Points/M)
alter table artists add column if not exists cost integer not null default 10;
alter table artists add column if not exists tier text not null default 'B';

-- 2. Raise roster limit from 5 to 7
create or replace function check_roster_limit()
returns trigger as $$
begin
  if (select count(*) from roster_entries where user_id = new.user_id) >= 7 then
    raise exception 'Roster limit reached (7 artists max)';
  end if;
  return new;
end;
$$ language plpgsql;
-- trigger already attached from original schema.sql, function replace is enough

-- 3. Reseed with the full 100-artist pool (cost + tier)
insert into artists (slug, name, initials, color, cost, tier) values
  ('ninho', 'Ninho', 'N', '#dda63a', 28, 'S'),
  ('jul', 'Jul', 'J', '#8a6cff', 25, 'S'),
  ('plk', 'PLK', 'P', '#e8455f', 33, 'S'),
  ('gims', 'Gims', 'G', '#3aa6dd', 32, 'S'),
  ('orelsan', 'Orelsan', 'O', '#6cd98a', 32, 'S'),
  ('booba', 'Booba', 'B', '#dd7a3a', 29, 'S'),
  ('damso', 'Damso', 'D', '#dda63a', 28, 'S'),
  ('sch', 'SCH', 'S', '#8a6cff', 27, 'S'),
  ('nekfeu', 'Nekfeu', 'N', '#e8455f', 38, 'S'),
  ('vald', 'Vald', 'V', '#3aa6dd', 26, 'S'),
  ('werenoi', 'Werenoi', 'W', '#6cd98a', 25, 'S'),
  ('tiakola', 'Tiakola', 'T', '#dd7a3a', 27, 'S'),
  ('gazo', 'Gazo', 'G', '#dda63a', 31, 'S'),
  ('niska', 'Niska', 'N', '#8a6cff', 32, 'S'),
  ('soolking', 'Soolking', 'S', '#e8455f', 25, 'S'),
  ('naps', 'Naps', 'N', '#3aa6dd', 31, 'S'),
  ('freeze-corleone', 'Freeze Corleone', 'FC', '#6cd98a', 23, 'A'),
  ('laylow', 'Laylow', 'L', '#dd7a3a', 22, 'A'),
  ('hamza', 'Hamza', 'H', '#dda63a', 23, 'A'),
  ('dinos', 'Dinos', 'D', '#8a6cff', 20, 'A'),
  ('alpha-wann', 'Alpha Wann', 'AW', '#e8455f', 18, 'A'),
  ('josman', 'Josman', 'J', '#3aa6dd', 15, 'A'),
  ('kaaris', 'Kaaris', 'K', '#6cd98a', 19, 'A'),
  ('alonzo', 'Alonzo', 'A', '#dd7a3a', 21, 'A'),
  ('lacrim', 'Lacrim', 'L', '#dda63a', 16, 'A'),
  ('maes', 'Maes', 'M', '#8a6cff', 24, 'A'),
  ('koba-lad', 'Koba LaD', 'KL', '#e8455f', 25, 'A'),
  ('heuss-lenfoire', 'Heuss l''Enfoire', 'HL', '#3aa6dd', 12, 'A'),
  ('sofiane', 'Sofiane', 'S', '#6cd98a', 24, 'A'),
  ('la-fouine', 'La Fouine', 'LF', '#dd7a3a', 24, 'A'),
  ('bigflo-and-oli', 'Bigflo & Oli', 'BO', '#dda63a', 14, 'A'),
  ('lomepal', 'Lomepal', 'L', '#8a6cff', 23, 'A'),
  ('kekra', 'Kekra', 'K', '#e8455f', 18, 'A'),
  ('kery-james', 'Kery James', 'KJ', '#3aa6dd', 17, 'A'),
  ('rohff', 'Rohff', 'R', '#6cd98a', 16, 'A'),
  ('youssoupha', 'Youssoupha', 'Y', '#dd7a3a', 14, 'A'),
  ('zola', 'Zola', 'Z', '#dda63a', 15, 'A'),
  ('sdm', 'SDM', 'S', '#8a6cff', 24, 'A'),
  ('chily', 'Chily', 'C', '#e8455f', 17, 'A'),
  ('guy2bezbar', 'Guy2Bezbar', 'G', '#3aa6dd', 13, 'A'),
  ('leto', 'Leto', 'L', '#6cd98a', 6, 'B'),
  ('larry', 'Larry', 'L', '#dd7a3a', 11, 'B'),
  ('ziak', 'Ziak', 'Z', '#dda63a', 6, 'B'),
  ('mairo', 'Mairo', 'M', '#8a6cff', 10, 'B'),
  ('elams', 'Elams', 'E', '#e8455f', 10, 'B'),
  ('luv-resval', 'Luv Resval', 'LR', '#3aa6dd', 9, 'B'),
  ('djadja-and-dinaz', 'Djadja & Dinaz', 'DD', '#6cd98a', 5, 'B'),
  ('naza', 'Naza', 'N', '#dd7a3a', 12, 'B'),
  ('franglish', 'Franglish', 'F', '#dda63a', 6, 'B'),
  ('13-block', '13 Block', '1B', '#8a6cff', 11, 'B'),
  ('kofs', 'Kofs', 'K', '#e8455f', 6, 'B'),
  ('sadek', 'Sadek', 'S', '#3aa6dd', 9, 'B'),
  ('zkr', 'Zkr', 'Z', '#6cd98a', 10, 'B'),
  ('bramsito', 'Bramsito', 'B', '#dd7a3a', 8, 'B'),
  ('da-uzi', 'Da Uzi', 'DU', '#dda63a', 6, 'B'),
  ('fixpen-sniper', 'Fixpen Sniper', 'FS', '#8a6cff', 5, 'B'),
  ('doums', 'Doums', 'D', '#e8455f', 8, 'B'),
  ('deen-burbigo', 'Deen Burbigo', 'DB', '#3aa6dd', 9, 'B'),
  ('spri-noir', 'S.Pri Noir', 'SN', '#6cd98a', 6, 'B'),
  ('nemir', 'Nemir', 'N', '#dd7a3a', 8, 'B'),
  ('jazzy-bazz', 'Jazzy Bazz', 'JB', '#dda63a', 6, 'B'),
  ('georgio', 'Georgio', 'G', '#8a6cff', 11, 'B'),
  ('romeo-elvis', 'Romeo Elvis', 'RE', '#e8455f', 9, 'B'),
  ('caballero-and-jeanjass', 'Caballero & JeanJass', 'CJ', '#3aa6dd', 12, 'B'),
  ('kalash-criminel', 'Kalash Criminel', 'KC', '#6cd98a', 10, 'B'),
  ('dosseh', 'Dosseh', 'D', '#dd7a3a', 7, 'B'),
  ('timal', 'Timal', 'T', '#dda63a', 10, 'B'),
  ('doria', 'Doria', 'D', '#8a6cff', 10, 'B'),
  ('black-m', 'Black M', 'BM', '#e8455f', 8, 'B'),
  ('barack-adama', 'Barack Adama', 'BA', '#3aa6dd', 9, 'B'),
  ('ashe-22', 'Ashe 22', 'A2', '#6cd98a', 1, 'C'),
  ('luther', 'Luther', 'L', '#dd7a3a', 5, 'C'),
  ('rsko', 'RSKO', 'R', '#dda63a', 2, 'C'),
  ('fave', 'Fave', 'F', '#8a6cff', 5, 'C'),
  ('zed', 'Zed', 'Z', '#e8455f', 2, 'C'),
  ('djame', 'Djame', 'D', '#3aa6dd', 2, 'C'),
  ('kaza', 'Kaza', 'K', '#6cd98a', 4, 'C'),
  ('krago', 'K.Rago', 'K', '#dd7a3a', 4, 'C'),
  ('prinz-p', 'Prinz P', 'PP', '#dda63a', 3, 'C'),
  ('kompact', 'Kompact', 'K', '#8a6cff', 5, 'C'),
  ('meech', 'Meech', 'M', '#e8455f', 2, 'C'),
  ('sopico', 'Sopico', 'S', '#3aa6dd', 3, 'C'),
  ('lno', 'LNO', 'L', '#6cd98a', 1, 'C'),
  ('fresh-la-peufra', 'Fresh La Peufra', 'FL', '#dd7a3a', 2, 'C'),
  ('junior-bvndo', 'Junior Bvndo', 'JB', '#dda63a', 1, 'C'),
  ('lalgerino', 'L''Algerino', 'LA', '#8a6cff', 3, 'C'),
  ('sirak', 'Sirak', 'S', '#e8455f', 4, 'C'),
  ('kacem-wapalek', 'Kacem Wapalek', 'KW', '#3aa6dd', 3, 'C'),
  ('nepal', 'Nepal', 'N', '#6cd98a', 1, 'C'),
  ('bosh', 'Bosh', 'B', '#dd7a3a', 2, 'C'),
  ('rimk', 'Rim''K', 'RK', '#dda63a', 5, 'C'),
  ('sultan', 'Sultan', 'S', '#8a6cff', 3, 'C'),
  ('blacko', 'Blacko', 'B', '#e8455f', 2, 'C'),
  ('youv-dee', 'Youv Dee', 'YD', '#3aa6dd', 4, 'C'),
  ('kikesa', 'Kikesa', 'K', '#6cd98a', 4, 'C'),
  ('enjoy', 'Enjoy', 'E', '#dd7a3a', 4, 'C'),
  ('aden', 'Aden', 'A', '#dda63a', 2, 'C'),
  ('guirri-mafia', 'Guirri Mafia', 'GM', '#8a6cff', 3, 'C'),
  ('landy', 'Landy', 'L', '#e8455f', 2, 'C'),
  ('skore', 'Skore', 'S', '#3aa6dd', 2, 'C')
on conflict (slug) do update set
  cost = excluded.cost,
  tier = excluded.tier,
  name = excluded.name,
  initials = excluded.initials,
  color = excluded.color;

-- ============================================================
-- IMPORTANT: the old 12-artist seed (ninho, jul, plk, sdm, tiakola, gazo,
-- werenoi, damso, niska, freeze-corleone, laylow, zola) will just have
-- their cost/tier updated by the ON CONFLICT clause above — no data loss.
-- All 88 new artists get added fresh.
-- ============================================================

-- 4. OPTIONAL SAFETY NET: clear any existing rosters that are now invalid
-- (drafted under the old 5-slot/no-budget rules). Only run this if you
-- want a clean slate for testing — this deletes all current roster picks.
-- Uncomment the line below if you want to reset every user's roster:
-- delete from roster_entries;
