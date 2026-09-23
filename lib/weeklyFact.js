// Real, per-phase facts for the weekly banner — the whole point is that the
// banner's copy is never generic ("n'oublie pas...") but always grounded in
// something true about THIS user or THIS week's pool, fetched fresh on every
// page load. No fact found (new account, quiet pool) -> null, banner falls
// back to its identity headline alone rather than inventing urgency.
export async function getWeeklyFact(supabase, userId, phase) {
  if (phase === "team") {
    const { data: rosterRows } = await supabase
      .from("roster_entries")
      .select("artists(name, score)")
      .eq("user_id", userId);
    const roster = (rosterRows || []).map((r) => r.artists).filter(Boolean);
    if (!roster.length) return null;
    const top = roster.reduce(
      (max, a) => ((a.score ?? 0) > (max?.score ?? -Infinity) ? a : max),
      null
    );
    if (!top) return null;
    return `Ton meilleur talent : ${top.name} (${top.score} pts)`;
  }

  if (phase === "predictions") {
    // The engine already computes this every run (Radar's weekly award) —
    // reused here rather than a new query, so this can never drift from
    // what Radar itself shows.
    const { data: award } = await supabase
      .from("weekly_awards")
      .select("value, artists(name)")
      .eq("award_type", "most_momentum")
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (award?.artists?.name && award.value > 0) {
      return `Plus grosse progression cette semaine : ${award.artists.name} (+${award.value} pts)`;
    }
    return null;
  }

  return null;
}
