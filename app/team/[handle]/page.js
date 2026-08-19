import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTeamLevel, TEAM_MAX_MEMBERS } from "@/lib/gameRules";
import { computeTeamDuelSide } from "@/lib/duels";
import TeamActions from "./TeamActions";

export default async function TeamPage({ params }) {
  const { handle } = await params;
  const supabase = await createClient();

  const { data: team } = await supabase.from("teams").select("*").eq("handle", handle).single();

  if (!team) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <div className="display text-xl mb-2">Aucune équipe ici.</div>
        <p className="text-[var(--text-faint)] text-sm">Vérifie le lien.</p>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberRows } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", team.id);
  const memberIds = (memberRows || []).map((m) => m.user_id);
  const isMember = !!user && memberIds.includes(user.id);
  const isOwner = !!user && user.id === team.owner_id;
  const full = memberIds.length >= TEAM_MAX_MEMBERS;

  let contributions = [];
  if (memberIds.length > 0) {
    const { data } = await supabase.from("user_totals").select("*").in("user_id", memberIds);
    contributions = (data || []).sort((a, b) => b.total_score - a.total_score);
  }
  const teamScore = contributions.reduce((s, c) => s + (c.total_score || 0), 0);
  const { level, ceiling, progressPct } = getTeamLevel(teamScore);

  // --- Active team duel, if any ---
  // Fetched as raw rows (not an embedded join) — team_duels has TWO foreign
  // keys into teams (team_a_id, team_b_id), and guessing Postgres's
  // auto-generated constraint name for a PostgREST embed hint is fragile.
  // A second plain query for the opponent is simpler and always correct.
  const { data: duelRows } = await supabase
    .from("team_duels")
    .select("*")
    .or(`team_a_id.eq.${team.id},team_b_id.eq.${team.id}`)
    .order("created_at", { ascending: false })
    .limit(1);
  const duel = duelRows?.[0] || null;
  let duelScores = null;
  if (duel) {
    const opponentId = duel.team_a_id === team.id ? duel.team_b_id : duel.team_a_id;
    const { data: opponent } = await supabase
      .from("teams")
      .select("id, name, handle, color")
      .eq("id", opponentId)
      .single();
    if (opponent) {
      const [myScore, oppScore] = await Promise.all([
        computeTeamDuelSide(supabase, team.id, duel.created_at, duel.week_end),
        computeTeamDuelSide(supabase, opponent.id, duel.created_at, duel.week_end),
      ]);
      const finished = new Date(duel.week_end) <= new Date();
      duelScores = { opponent, myScore, oppScore, finished };
    }
  }

  return (
    <div className="min-h-screen pb-16 px-5 pt-8 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black flex-shrink-0"
          style={{ background: team.color }}
        >
          {team.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-faint)] font-bold">
            Équipe · Niveau {level}
          </div>
          <div className="display text-xl leading-tight">{team.name}</div>
        </div>
      </div>

      {/* Level progress */}
      <div className="mb-4">
        <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${progressPct}%`, background: team.color }} />
        </div>
        <div className="text-[10px] text-[var(--text-faint)] mt-1">
          {ceiling ? `${teamScore} / ${ceiling} pts pour le niveau ${level + 1}` : `${teamScore} pts · niveau max`}
        </div>
      </div>

      {/* Team score */}
      <div className="bg-gradient-to-br from-[var(--surface)] to-[var(--bg-alt)] border border-[var(--border)] rounded-2xl p-5 mb-4 text-center">
        <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-1">
          Score d&apos;équipe
        </div>
        <div className="display text-4xl text-[var(--gold)]">{teamScore}</div>
        <div className="text-xs text-[var(--text-faint)] mt-1">
          {memberIds.length}/{TEAM_MAX_MEMBERS} membres
        </div>
      </div>

      {/* Duel status */}
      <div className="bg-[var(--surface)] border border-[var(--violet)]/40 rounded-2xl p-3.5 mb-4">
        <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-2">
          ⚔️ Duel
        </div>
        {duel && duelScores ? (
          <div>
            <div className="flex items-center justify-between text-sm font-bold mb-1">
              <span>{team.name}</span>
              <span className="text-[var(--text-faint)] text-xs">vs</span>
              <span>{duelScores.opponent.name}</span>
            </div>
            <div className="flex items-center justify-between mono text-lg font-bold">
              <span className={duelScores.myScore >= duelScores.oppScore ? "text-[var(--gold)]" : "text-[var(--text)]"}>
                {duelScores.myScore}
              </span>
              <span className={duelScores.oppScore >= duelScores.myScore ? "text-[var(--gold)]" : "text-[var(--text)]"}>
                {duelScores.oppScore}
              </span>
            </div>
            <div className="text-[11px] text-[var(--text-faint)] mt-1">
              {duelScores.finished ? "Duel terminé" : `En cours · fin ${new Date(duel.week_end).toLocaleDateString("fr-FR")}`}
            </div>
          </div>
        ) : (
          <div className="text-xs text-[var(--text-faint)]">Aucun duel en cours.</div>
        )}
        {isMember && (
          <Link
            href={`/team/${team.handle}/duel`}
            className="block text-center mt-3 text-xs font-bold text-[#1a1310] bg-[var(--violet)] rounded-lg py-2"
          >
            {duel && !duelScores?.finished ? "Voir le duel" : "Lancer un duel"}
          </Link>
        )}
      </div>

      <TeamActions
        team={{ id: team.id, handle: team.handle }}
        isLoggedIn={!!user}
        isOwner={isOwner}
        isMember={isMember}
        full={full}
      />

      {/* Contribution board */}
      <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-3 mt-8">
        Contribution de chacun
      </div>
      {contributions.length === 0 && (
        <div className="text-center text-[var(--text-faint)] text-sm py-6">Personne pour l&apos;instant.</div>
      )}
      {contributions.map((c) => (
        <div
          key={c.user_id}
          className="flex items-center gap-3 px-3 py-2.5 rounded-2xl mb-1.5 border border-[var(--border)]"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
            style={{ background: team.color }}
          >
            {c.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">
              {c.username}
              {c.user_id === team.owner_id && (
                <span className="text-[10px] text-[var(--text-faint)]"> · fondateur</span>
              )}
              {user && c.user_id === user.id ? " (toi)" : ""}
            </div>
          </div>
          <div className="mono text-sm font-bold">{c.total_score} pts</div>
        </div>
      ))}

      {isMember && (
        <Link
          href={`/team/${team.handle}/recap`}
          className="block text-center mt-6 text-xs font-bold text-[var(--text-muted)] underline"
        >
          📊 Voir le bilan de l&apos;équipe
        </Link>
      )}
    </div>
  );
}
