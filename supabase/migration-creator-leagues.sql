-- ============================================================
-- MIGRATION — Creator private leagues (MVP)
-- Run this in Supabase SQL Editor. Safe: only adds two new tables.
--
-- Scope: a league is a NAMED, BRANDED, SHAREABLE scope over the SAME shared
-- game — same artists, same scoring engine, same roster rules. It doesn't
-- fork the game, it just filters the leaderboard to a chosen group of
-- members and wraps it in the creator's own branding. Per-league scoring
-- weights / custom artist pools are a real future step, not this one.
-- ============================================================

create table if not exists leagues (
  id uuid primary key default gen_random_uuid(),
  handle text unique not null,           -- url slug: /league/kevin
  name text not null,                    -- "La Ligue du 91" — free, not auto-generated
  owner_id uuid not null references profiles(id) on delete cascade,
  color_primary text not null default '#dda63a',
  color_secondary text not null default '#8a6cff',
  tagline text,
  youtube_url text,
  twitch_url text,
  tiktok_url text,
  instagram_url text,
  invite_code text unique not null,
  member_cap integer,
  created_at timestamptz not null default now()
);

create table if not exists league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique(league_id, user_id)
);

alter table leagues enable row level security;
alter table league_members enable row level security;

-- League pages are public (that's the point — shareable, brandable territory)
create policy "leagues readable by all" on leagues for select using (true);
create policy "league_members readable by all" on league_members for select using (true);

-- Only the creator can create their own league; anyone can join themselves
create policy "users create own league" on leagues for insert with check (auth.uid() = owner_id);
create policy "users update own league" on leagues for update using (auth.uid() = owner_id);
create policy "users join a league themselves" on league_members for insert with check (auth.uid() = user_id);
create policy "users leave a league themselves" on league_members for delete using (auth.uid() = user_id);
