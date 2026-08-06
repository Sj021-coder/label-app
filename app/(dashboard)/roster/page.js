import { createClient } from "@/lib/supabase/server";
import { ROSTER_SIZE, meetsDiversityRule } from "@/lib/gameRules";
import RosterClient from "./RosterClient";

export default async function RosterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rosterRows } = await supabase
    .from("roster_entries")
    .select("artist_id, artists(id, name, initials, color, score, cost, tier)")
    .eq("user_id", user.id);

  const roster = (rosterRows || []).map((r) => r.artists).filter(Boolean);
  const rosterIds = roster.map((a) => a.id);
  const hasDiversity = meetsDiversityRule(roster);

  const { data: profile } = await supabase
    .from("profiles")
    .select("captain_artist_id, free_transfers, penalty_points")
    .eq("id", user.id)
    .single();

  let recentEvents = [];
  if (rosterIds.length > 0) {
    const { data } = await supabase
      .from("score_events")
      .select("id, label, delta, category, created_at, artist_id, artists(name)")
      .in("artist_id", rosterIds)
      .order("created_at", { ascending: false })
      .limit(8);
    recentEvents = data || [];
  }

  return (
    <RosterClient
      roster={roster}
      rosterSize={ROSTER_SIZE}
      hasDiversity={hasDiversity}
      captainArtistId={profile?.captain_artist_id || null}
      freeTransfers={profile?.free_transfers ?? 1}
      penaltyPoints={profile?.penalty_points ?? 0}
      recentEvents={recentEvents}
    />
  );
}
