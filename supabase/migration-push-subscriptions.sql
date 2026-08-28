-- Stores one row per device a user has enabled notifications on (a user
-- can have several — phone + laptop — so this is NOT one-per-user).
-- `endpoint` is the unique push URL the browser gives us; it doubles as
-- the natural dedupe key (re-subscribing on the same device just updates
-- the same row instead of creating a duplicate).
drop table if exists push_subscriptions cascade;

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- A user can only manage their own subscriptions. Sending a push happens
-- server-side via the service_role key (daily-sync.mjs, API routes using
-- the admin client), which bypasses RLS entirely — these policies are
-- only about what a logged-in browser is allowed to do directly.
create policy "Users manage their own push subscriptions"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
