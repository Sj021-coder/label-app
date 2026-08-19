import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSharedWeek } from "@/lib/weeklyProgram";
import { sizeBucket } from "@/lib/duels";

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { teamId, mode, opponentTeamId } = await request.json();

  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .single();
  if (!membership) return NextResponse.json({ error: "Tu n'es pas dans cette équipe." }, { status: 403 });

  const { end: weekEnd } = getSharedWeek();

  // Already has an active duel this window? One at a time, keeps it simple
  // and keeps the "collective responsibility" story legible.
  const { data: existing } = await supabase
    .from("team_duels")
    .select("id")
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
    .gte("week_end", new Date().toISOString())
    .limit(1);
  if (existing && existing.length) {
    return NextResponse.json({ error: "Ton équipe a déjà un duel en cours." }, { status: 400 });
  }

  let opponentId = opponentTeamId;

  if (mode === "random") {
    const { data: myMembers } = await supabase.from("team_members").select("user_id").eq("team_id", teamId);
    const myBucket = sizeBucket((myMembers || []).length);

    const { data: allTeams } = await supabase.from("teams").select("id").neq("id", teamId);
    const { data: allMembers } = await supabase.from("team_members").select("team_id, user_id");
    const { data: activeDuels } = await supabase
      .from("team_duels")
      .select("team_a_id, team_b_id")
      .gte("week_end", new Date().toISOString());

    const busyTeamIds = new Set();
    for (const d of activeDuels || []) {
      busyTeamIds.add(d.team_a_id);
      busyTeamIds.add(d.team_b_id);
    }
    const countByTeam = {};
    for (const m of allMembers || []) countByTeam[m.team_id] = (countByTeam[m.team_id] || 0) + 1;

    const eligible = (allTeams || []).filter(
      (t) => !busyTeamIds.has(t.id) && sizeBucket(countByTeam[t.id] || 0) === myBucket
    );
    if (!eligible.length) {
      return NextResponse.json(
        { error: "Aucune équipe disponible de taille comparable pour l'instant." },
        { status: 400 }
      );
    }
    opponentId = eligible[Math.floor(Math.random() * eligible.length)].id;
  } else {
    if (!opponentId || opponentId === teamId) {
      return NextResponse.json({ error: "Choisis une équipe adverse valide." }, { status: 400 });
    }
    const { data: oppBusy } = await supabase
      .from("team_duels")
      .select("id")
      .or(`team_a_id.eq.${opponentId},team_b_id.eq.${opponentId}`)
      .gte("week_end", new Date().toISOString())
      .limit(1);
    if (oppBusy && oppBusy.length) {
      return NextResponse.json({ error: "Cette équipe a déjà un duel en cours." }, { status: 400 });
    }
  }

  const { error: insErr } = await supabase.from("team_duels").insert({
    team_a_id: teamId,
    team_b_id: opponentId,
    mode: mode === "random" ? "random" : "chosen",
    week_end: weekEnd.toISOString(),
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
