-- Same pattern as `user_totals`: a DB view so a team's score is always
-- computed fresh from the real source of truth (score_events, via
-- user_totals) at read time — never a JS-side .reduce() across 3 separate
-- queries that can drift out of sync with each other under load.
-- Replaces the aggregation previously done in app/teams/page.js.
create or replace view team_totals as
select
  t.id as team_id,
  t.handle,
  t.name,
  t.color,
  t.owner_id,
  count(tm.user_id) as member_count,
  coalesce(sum(ut.total_score), 0) as team_score
from teams t
left join team_members tm on tm.team_id = t.id
left join user_totals ut on ut.user_id = tm.user_id
group by t.id, t.handle, t.name, t.color, t.owner_id;
