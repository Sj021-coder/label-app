import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeTeamDuelSide } from "@/lib/duels";
import StartTeamDuel from "./StartTeamDuel";
import LiveRefresh from "@/components/LiveRefresh";

export default async function TeamDuelPage({ params }) {
  const { handle } = await params;
  const supabase = await createClient();

  const { data: team } = await supabase.from("teams").select("*").eq("handle", handle).single();
  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--text-faint)]">
        Équipe introuvable.
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: membership } = user
    ? await supabase.from("team_members").select("team_id").eq("team_id", team.id).eq("user_id", user.id).single()
    : { data: null };

  if (!membership) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[var(--text-muted)] text-sm mb-4">
          Rejoins l&apos;équipe pour voir ses duels.
        </p>
        <Link href={`/team/${team.handle}`} className="text-[var(--gold)] text-sm font-bold">
          ← Retour à l&apos;équipe
        </Link>
      </div>
    );
  }

  const { data: duelRows } = await supabase
    .from("team_duels")
    .select("*")
    .or(`team_a_id.eq.${team.id},team_b_id.eq.${team.id}`)
    .order("created_at", { ascending: false })
    .limit(1);
  const duel = duelRows?.[0] || null;
  const active = duel && new Date(duel.week_end) > new Date();

  let duelView = null;
  if (duel) {
    const opponentId = duel.team_a_id === team.id ? duel.team_b_id : duel.team_a_id;
    const { data: opponent } = await supabase.from("teams").select("id, name, color").eq("id", opponentId).single();
    if (opponent) {
      const [myScore, oppScore] = await Promise.all([
        computeTeamDuelSide(supabase, team.id, duel.created_at, duel.week_end),
        computeTeamDuelSide(supabase, opponent.id, duel.created_at, duel.week_end),
      ]);
      duelView = { opponent, myScore, oppScore, finished: !active };
    }
  }

  let eligibleTeams = [];
  if (!active) {
    const { data: allTeams } = await supabase.from("teams").select("id, name, color").neq("id", team.id);
    const { data: activeDuels } = await supabase
      .from("team_duels")
      .select("team_a_id, team_b_id")
      .gte("week_end", new Date().toISOString());
    const busy = new Set();
    for (const d of activeDuels || []) {
      busy.add(d.team_a_id);
      busy.add(d.team_b_id);
    }
    eligibleTeams = (allTeams || []).filter((t) => !busy.has(t.id));
  }

  return (
    <div className="min-h-screen px-5 pt-8 pb-10 max-w-md mx-auto">
      <LiveRefresh table="artists" event="UPDATE" channelName={`team-duel-live-${team.id}`} />

      <Link href={`/team/${team.handle}`} className="text-xs text-[var(--text-faint)] mb-4 inline-block">
        ← {team.name}
      </Link>
      <div className="display text-2xl mb-6">⚔️ Duel</div>

      {duelView ? (
        <div className="bg-[var(--surface)] border border-[var(--violet)]/40 rounded-2xl p-5 mb-6 text-center">
          <div className="flex items-center justify-around mb-3">
            <div className="flex-1">
              <div
                className="w-12 h-12 rounded-full mx-auto mb-1 flex items-center justify-center text-white font-black"
                style={{ background: team.color }}
              >
                {team.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="text-xs font-bold">{team.name}</div>
              <div className="display text-2xl text-[var(--gold)]">{duelView.myScore}</div>
            </div>
            <div className="text-[var(--text-faint)] text-sm px-2">vs</div>
            <div className="flex-1">
              <div
                className="w-12 h-12 rounded-full mx-auto mb-1 flex items-center justify-center text-white font-black"
                style={{ background: duelView.opponent.color }}
              >
                {duelView.opponent.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="text-xs font-bold">{duelView.opponent.name}</div>
              <div className="display text-2xl">{duelView.oppScore}</div>
            </div>
          </div>
          <div className="text-xs text-[var(--text-faint)]">
            {duelView.finished
              ? duelView.myScore === duelView.oppScore
                ? "Match nul"
                : duelView.myScore > duelView.oppScore
                ? "🏆 Victoire !"
                : "Défaite cette semaine"
              : `En cours · résultat le ${new Date(duel.week_end).toLocaleDateString("fr-FR")}`}
          </div>
        </div>
      ) : (
        <div className="text-center text-[var(--text-faint)] text-sm mb-6">Aucun duel en cours.</div>
      )}

      {!active && <StartTeamDuel teamId={team.id} eligibleTeams={eligibleTeams} />}
    </div>
  );
}
