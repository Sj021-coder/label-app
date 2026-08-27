import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTeamLevel } from "@/lib/gameRules";
import LiveRefresh from "@/components/LiveRefresh";

export default async function TeamsLeaderboardPage() {
  const supabase = await createClient();

  // One query against `team_totals` (a DB view, same pattern as
  // `user_totals`) instead of 3 separate queries stitched together in JS —
  // the score shown here can never drift from the real, live source of truth.
  const { data: teams } = await supabase
    .from("team_totals")
    .select("team_id, handle, name, color, member_count, team_score")
    .order("team_score", { ascending: false });

  const ranked = (teams || []).map((t) => ({
    ...t,
    level: getTeamLevel(t.team_score).level,
  }));

  return (
    <div className="min-h-screen px-5 pt-8 pb-10 max-w-md mx-auto">
      <LiveRefresh table="artists" event="UPDATE" channelName="teams-leaderboard-live" />

      <div className="text-center mb-6">
        <div className="display text-2xl mb-1">Classement des équipes</div>
        <p className="text-[var(--text-faint)] text-sm">Score cumulé de tous les membres.</p>
      </div>

      {ranked.length === 0 && (
        <div className="text-center text-[var(--text-faint)] text-sm py-6">
          Aucune équipe encore — sois le premier.
        </div>
      )}

      {ranked.map((t, i) => (
        <Link
          key={t.team_id}
          href={`/team/${t.handle}`}
          className="flex items-center gap-3 px-3 py-2.5 rounded-2xl mb-1.5 border border-[var(--border)] bg-[var(--surface)]"
        >
          <div className="w-6 text-center mono text-[var(--text-faint)] text-sm">{i + 1}</div>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-xs flex-shrink-0"
            style={{ background: t.color }}
          >
            {t.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">{t.name}</div>
            <div className="text-[10px] text-[var(--text-faint)]">
              Niv. {t.level} · {t.member_count} membre{t.member_count > 1 ? "s" : ""}
            </div>
          </div>
          <div className="mono text-sm font-bold text-[var(--gold)]">{t.team_score} pts</div>
        </Link>
      ))}
    </div>
  );
}
