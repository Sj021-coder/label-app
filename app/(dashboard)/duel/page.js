import { createClient } from "@/lib/supabase/server";
import { computeUserDuelSide } from "@/lib/duels";
import StartUserDuel from "./StartUserDuel";
import LiveRefresh from "@/components/LiveRefresh";

export default async function UserDuelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: duelRows } = await supabase
    .from("user_duels")
    .select("*")
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(1);
  const duel = duelRows?.[0] || null;
  const active = duel && new Date(duel.week_end) > new Date();

  let duelView = null;
  if (duel) {
    const opponentId = duel.user_a_id === user.id ? duel.user_b_id : duel.user_a_id;
    const { data: opponent } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("id", opponentId)
      .single();
    if (opponent) {
      const [myScore, oppScore] = await Promise.all([
        computeUserDuelSide(supabase, user.id, duel.created_at, duel.week_end),
        computeUserDuelSide(supabase, opponent.id, duel.created_at, duel.week_end),
      ]);
      duelView = { opponent, myScore, oppScore, finished: !active };
    }
  }

  // Candidate opponents = teammates across all teams you're in — "duel a
  // friend" is the point, not a random stranger from the whole user base.
  let teammates = [];
  if (!active) {
    const { data: myTeamRows } = await supabase.from("team_members").select("team_id").eq("user_id", user.id);
    const teamIds = (myTeamRows || []).map((r) => r.team_id);
    if (teamIds.length) {
      const { data: memberRows } = await supabase
        .from("team_members")
        .select("user_id, profiles(username)")
        .in("team_id", teamIds)
        .neq("user_id", user.id);
      const seen = new Set();
      teammates = (memberRows || [])
        .filter((m) => m.profiles && !seen.has(m.user_id) && seen.add(m.user_id))
        .map((m) => ({ id: m.user_id, username: m.profiles.username }));
    }
  }

  return (
    <div>
      <LiveRefresh table="artists" event="UPDATE" channelName="user-duel-live" />

      <div className="display text-2xl mb-1">⚔️ Duel</div>
      <p className="text-[var(--text-faint)] text-sm mb-6">Micro-comparaison, juste toi vs eux.</p>

      {duelView ? (
        <div className="bg-[var(--surface)] border border-[var(--violet)]/40 rounded-2xl p-5 mb-6 text-center">
          <div className="flex items-center justify-around mb-3">
            <div className="flex-1">
              <div className="text-xs font-bold mb-1">Toi</div>
              <div className="display text-2xl text-[var(--gold)]">{duelView.myScore}</div>
            </div>
            <div className="text-[var(--text-faint)] text-sm px-2">vs</div>
            <div className="flex-1">
              <div className="text-xs font-bold mb-1">{duelView.opponent.username}</div>
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

      {!active && <StartUserDuel teammates={teammates} />}
    </div>
  );
}
