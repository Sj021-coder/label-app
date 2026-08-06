-- ============================================================
-- LABEL — Migration v2: Budget system + bigger roster
-- Run this in Supabase SQL Editor (after schema.sql has already been run once)
-- Rules: 7 roster slots, 100M budget, 50-artist pool
-- ============================================================

-- 1. Add a cost column (in millions) to artists
alter table artists add column if not exists cost integer not null default 10;

-- 2. Set cost for the original 12 artists
update artists set cost = 30 where slug = 'ninho';
update artists set cost = 29 where slug = 'jul';
update artists set cost = 24 where slug = 'plk';
update artists set cost = 20 where slug = 'sdm';
update artists set cost = 20 where slug = 'tiakola';
update artists set cost = 23 where slug = 'gazo';
update artists set cost = 19 where slug = 'werenoi';
update artists set cost = 27 where slug = 'damso';
update artists set cost = 21 where slug = 'niska';
update artists set cost = 17 where slug = 'freeze-corleone';
update artists set cost = 16 where slug = 'laylow';
update artists set cost = 12 where slug = 'zola';

-- 3. Add 38 more artists to reach a 50-artist pool
insert into artists (slug, name, initials, color, cost) values
  ('booba', 'Booba', 'BO', '#dda63a', 28),
  ('orelsan', 'Orelsan', 'OR', '#8a6cff', 22),
  ('nekfeu', 'Nekfeu', 'NE', '#e8455f', 18),
  ('vald', 'Vald', 'VA', '#3aa6dd', 18),
  ('alpha-wann', 'Alpha Wann', 'AW', '#6cd98a', 15),
  ('dinos', 'Dinos', 'DI', '#dd7a3a', 16),
  ('josman', 'Josman', 'JO', '#dda63a', 11),
  ('lomepal', 'Lomepal', 'LO', '#8a6cff', 17),
  ('sch', 'Sch', 'SC', '#e8455f', 19),
  ('kaaris', 'Kaaris', 'KA', '#3aa6dd', 18),
  ('hamza', 'Hamza', 'HA', '#6cd98a', 16),
  ('soolking', 'Soolking', 'SO', '#dd7a3a', 15),
  ('naps', 'Naps', 'NA', '#dda63a', 14),
  ('heuss-lenfoire', 'Heuss L''Enfoiré', 'HL', '#8a6cff', 15),
  ('georgio', 'Georgio', 'GE', '#e8455f', 10),
  ('luidji', 'Luidji', 'LU', '#3aa6dd', 9),
  ('dosseh', 'Dosseh', 'DO', '#6cd98a', 9),
  ('kalash-criminel', 'Kalash Criminel', 'KC', '#dd7a3a', 10),
  ('timal', 'Timal', 'TM', '#dda63a', 8),
  ('koba-lad', 'Koba LaD', 'KL', '#8a6cff', 12),
  ('franglish', 'Franglish', 'FR', '#e8455f', 9),
  ('guy2bezbar', 'Guy2Bezbar', 'G2', '#3aa6dd', 11),
  ('leto', 'Leto', 'LE', '#6cd98a', 8),
  ('nej', 'Nej', 'NJ', '#dd7a3a', 8),
  ('rk', 'RK', 'RK', '#dda63a', 9),
  ('ziak', 'Ziak', 'ZI', '#8a6cff', 10),
  ('mhd', 'MHD', 'MH', '#e8455f', 13),
  ('landy', 'Landy', 'LY', '#3aa6dd', 7),
  ('kekra', 'Kekra', 'KE', '#6cd98a', 8),
  ('larry', 'Larry', 'LR', '#dd7a3a', 8),
  ('rimk', 'Rim''K', 'RM', '#dda63a', 10),
  ('djadja-dinaz', 'Djadja & Dinaz', 'DD', '#8a6cff', 12),
  ('la-feve', 'La Fève', 'LF', '#e8455f', 6),
  ('fresh-la-peufra', 'Fresh La Peufra', 'FP', '#3aa6dd', 6),
  ('mairo', 'Mairo', 'MR', '#6cd98a', 6),
  ('doss', 'Doss', 'DS', '#dd7a3a', 5),
  ('luv-resval', 'Luv Resval', 'LV', '#dda63a', 7),
  ('chily', 'Chily', 'CH', '#8a6cff', 6)
on conflict (slug) do nothing;

-- 4. Replace the roster-limit trigger with a combined roster-size + budget check
create or replace function check_roster_constraints()
returns trigger as $$
declare
  current_count integer;
  current_spend integer;
  new_artist_cost integer;
begin
  select count(*) into current_count
  from roster_entries where user_id = new.user_id;

  if current_count >= 7 then
    raise exception 'Roster limit reached (7 artists max)';
  end if;

  select coalesce(sum(a.cost), 0) into current_spend
  from roster_entries re
  join artists a on a.id = re.artist_id
  where re.user_id = new.user_id;

  select cost into new_artist_cost from artists where id = new.artist_id;

  if (current_spend + new_artist_cost) > 100 then
    raise exception 'Budget exceeded (100M max)';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists roster_limit_trigger on roster_entries;
create trigger roster_constraints_trigger
  before insert on roster_entries
  for each row execute function check_roster_constraints();
