-- ============================================================
-- MIGRATION — Private Teams (fan/friend teams, distinct from Creator Leagues)
-- Run this in Supabase SQL Editor. Safe: only adds new tables.
--
-- Deliberately a SEPARATE system from `leagues`/`league_members`, not a
-- variant of it — this is "you're on a team, not ranked in a league": a
-- team's score is the SUM of its members, contribution is transparent, and
-- collective responsibility (duels, missions) applies to the whole group.
-- Creator Leagues stay branding/distribution-focused; Teams stay
-- collective-responsibility-focused. Streak is deliberately NOT built here
-- (explicitly deferred).
-- ============================================================

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  handle text unique not null,          -- url slug: /team/les-inseparables
  name text not null,
  owner_id uuid not null references profiles(id) on delete cascade,
  color text not null default '#8a6cff',
  invite_code text unique not null,
  created_at timestamptz not null default now()
  -- No stored level/XP column: level is DERIVED live from the team's real
  -- current aggregate score crossing TEAM_LEVEL_THRESHOLDS (lib/gameRules.js)
  -- — same "never stale, no job to run" philosophy as duels and Bilan.
);

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique(team_id, user_id)
);

-- Hard cap: 20 members, enforced at the database level (mirrors the
-- existing roster_limit_trigger pattern in schema.sql).
create or replace function check_team_member_limit()
returns trigger as $$
begin
  if (select count(*) from team_members where team_id = new.team_id) >= 20 then
    raise exception 'Team is full (20 members max)';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists team_member_limit_trigger on team_members;
create trigger team_member_limit_trigger
  before insert on team_members
  for each row execute function check_team_member_limit();

-- Duels — both team-vs-team and user-vs-user, same shape. Scores are NEVER
-- stored: they're computed live from real score_events within
-- [created_at, week_end), so there's no resolution job to run or forget —
-- reading a duel always reflects the real current (or final, once past
-- week_end) state.
create table if not exists team_duels (
  id uuid primary key default gen_random_uuid(),
  team_a_id uuid not null references teams(id) on delete cascade,
  team_b_id uuid not null references teams(id) on delete cascade,
  mode text not null default 'random',  -- 'random' | 'chosen'
  week_end timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists user_duels (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references profiles(id) on delete cascade,
  user_b_id uuid not null references profiles(id) on delete cascade,
  mode text not null default 'random',
  week_end timestamptz not null,
  created_at timestamptz not null default now()
);

alter table teams enable row level security;
alter table team_members enable row level security;
alter table team_duels enable row level security;
alter table user_duels enable row level security;

create policy "teams readable by all" on teams for select using (true);
create policy "team_members readable by all" on team_members for select using (true);
create policy "team_duels readable by all" on team_duels for select using (true);
create policy "user_duels readable by all" on user_duels for select using (true);

create policy "users create own team" on teams for insert with check (auth.uid() = owner_id);
create policy "users update own team" on teams for update using (auth.uid() = owner_id);
create policy "users join a team themselves" on team_members for insert with check (auth.uid() = user_id);
create policy "users leave a team themselves" on team_members for delete using (auth.uid() = user_id);

-- Any authenticated user can create a duel (either side) — starting a duel
-- isn't a privileged action, it's core gameplay.
create policy "authenticated users can create team duels" on team_duels for insert with check (auth.uid() is not null);
create policy "authenticated users can create user duels" on user_duels for insert with check (auth.uid() is not null);
