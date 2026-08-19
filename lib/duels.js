// Shared duel-scoring — a duel's score is NEVER stored, always computed
// live from real score_events within its window. No resolution job needed:
// once week_end passes, no more events fall inside the window, so reading a
// finished duel just naturally shows its final, frozen result.

async function rosterArtistIds(supabase, userIds) {
  if (!userIds.length) return [];
  const { data } = await supabase.from("roster_entries").select("artist_id").in("user_id", userIds);
  return [...new Set((data || []).map((r) => r.artist_id))];
}

async function scoreEventsSum(supabase, artistIds, sinceISO, untilISO) {
  if (!artistIds.length) return 0;
  const { data } = await supabase
    .from("score_events")
    .select("delta")
    .in("artist_id", artistIds)
    .gte("created_at", sinceISO)
    .lt("created_at", untilISO);
  return (data || []).reduce((s, e) => s + e.delta, 0);
}

// A duel's window never extends past "now" — capped so an unfinished duel
// shows its real running total, not a window that reaches into the future.
export function cappedEnd(weekEndISO) {
  const now = new Date().toISOString();
  return weekEndISO < now ? weekEndISO : now;
}

export async function computeTeamDuelSide(supabase, teamId, sinceISO, weekEndISO) {
  const { data: members } = await supabase.from("team_members").select("user_id").eq("team_id", teamId);
  const artistIds = await rosterArtistIds(supabase, (members || []).map((m) => m.user_id));
  return scoreEventsSum(supabase, artistIds, sinceISO, cappedEnd(weekEndISO));
}

export async function computeUserDuelSide(supabase, userId, sinceISO, weekEndISO) {
  const artistIds = await rosterArtistIds(supabase, [userId]);
  return scoreEventsSum(supabase, artistIds, sinceISO, cappedEnd(weekEndISO));
}

// Size bucket for fair random team matchmaking — chosen opponents skip this
// (a deliberate rivalry pick matters more than a size match).
export function sizeBucket(memberCount) {
  if (memberCount <= 5) return "small";
  if (memberCount <= 10) return "medium";
  if (memberCount <= 15) return "large";
  return "xlarge";
}
