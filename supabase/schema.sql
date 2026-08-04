-- ============================================================
-- LABEL — Fantasy Rap Platform — Core Schema
-- Run this in Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================

-- 1. ARTISTS -----------------------------------------------------
create table if not exists artists (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,          -- e.g. 'ninho'
  name text not null,
  initials text not null,
  color text not null default '#dda63a',
  score integer not null default 0,
  created_at timestamptz not null default now()
);

-- 2. SCORE HISTORY (append-only log — the scoring engine writes here) --
create table if not exists score_events (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references artists(id) on delete cascade,
  event_key text not null,            -- e.g. 'top50', 'award_win', 'custom'
  label text not null,                -- human-readable description
  delta integer not null,             -- points applied, can be negative
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

-- 3. PROFILES (extends Supabase auth.users with a public label name) --
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);

-- 4. ROSTER ENTRIES (max 5 per user, enforced in app + trigger below) --
create table if not exists roster_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  added_at timestamptz not null default now(),
  unique(user_id, artist_id)
);

-- Enforce max 5 artists per roster at the database level
create or replace function check_roster_limit()
returns trigger as $$
begin
  if (select count(*) from roster_entries where user_id = new.user_id) >= 5 then
    raise exception 'Roster limit reached (5 artists max)';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists roster_limit_trigger on roster_entries;
create trigger roster_limit_trigger
  before insert on roster_entries
  for each row execute function check_roster_limit();

-- 5. VIEW: leaderboard (sum of each user's roster artist scores) --
create or replace view leaderboard as
select
  p.id as user_id,
  p.username,
  coalesce(sum(a.score), 0) as total_score,
  count(re.artist_id) as roster_size
from profiles p
left join roster_entries re on re.user_id = p.id
left join artists a on a.id = re.artist_id
group by p.id, p.username
order by total_score desc;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table artists enable row level security;
alter table score_events enable row level security;
alter table profiles enable row level security;
alter table roster_entries enable row level security;

-- Anyone signed in can read artists, scores, profiles, rosters (public leaderboard)
create policy "artists readable by all" on artists for select using (true);
create policy "score_events readable by all" on score_events for select using (true);
create policy "profiles readable by all" on profiles for select using (true);
create policy "roster_entries readable by all" on roster_entries for select using (true);

-- Users can only create their own profile
create policy "users insert own profile" on profiles for insert with check (auth.uid() = id);

-- Users can only manage their own roster
create policy "users insert own roster" on roster_entries for insert with check (auth.uid() = user_id);
create policy "users delete own roster" on roster_entries for delete using (auth.uid() = user_id);

-- Scoring engine writes: for v1, any authenticated user can log an event (you = admin).
-- Tighten this later (e.g. check a role column) once you're not the only one running it.
create policy "authenticated users can score" on score_events for insert with check (auth.uid() is not null);
create policy "authenticated users can update artist score" on artists for update using (auth.uid() is not null);

-- ============================================================
-- SEED DATA — 12 curated, recognizable French rap artists
-- ============================================================
insert into artists (slug, name, initials, color) values
  ('ninho', 'Ninho', 'NI', '#dda63a'),
  ('jul', 'Jul', 'JU', '#8a6cff'),
  ('plk', 'PLK', 'PL', '#e8455f'),
  ('sdm', 'SDM', 'SD', '#3aa6dd'),
  ('tiakola', 'Tiakola', 'TI', '#6cd98a'),
  ('gazo', 'Gazo', 'GA', '#dd7a3a'),
  ('werenoi', 'Werenoi', 'WE', '#dda63a'),
  ('damso', 'Damso', 'DA', '#8a6cff'),
  ('niska', 'Niska', 'NK', '#e8455f'),
  ('freeze-corleone', 'Freeze Corleone', 'FC', '#3aa6dd'),
  ('laylow', 'Laylow', 'LA', '#6cd98a'),
  ('zola', 'Zola', 'ZO', '#dd7a3a')
on conflict (slug) do nothing;
