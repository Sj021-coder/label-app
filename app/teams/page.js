import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTeamLevel } from "@/lib/gameRules";

export default async function TeamsLeaderboardPage() {
  const supabase = await createClient();

  const [{ data: teams }, { data: memberRows }, { data: totals }] = await Promise.all([
    supabase.from("teams").select("id, handle, name, color"),
    supabase.from("team_members").select("team_id, user_id"),
    supabase.from("user_totals").select("user_id, total_score"),
  ]);

  const scoreByUser = Object.fromEntries((totals || []).map((t) => [t.user_id, t.total_score || 0]));
  const membersByTeam = {};
  for (const m of memberRows || []) {
    (membersByTeam[m.team_id] ||= []).push(m.user_id);
  }

  const ranked = (teams || [])
    .map((t) => {
      const memberIds = membersByTeam[t.id] || [];
      const score = memberIds.reduce((s, uid) => s + (scoreByUser[uid] || 0), 0);
      return { ...t, score, memberCount: memberIds.length, level: getTeamLevel(score).level };
    })
    .sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen px-5 pt-8 pb-10 max-w-md mx-auto">
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
          key={t.id}
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
              Niv. {t.level} · {t.memberCount} membre{t.memberCount > 1 ? "s" : ""}
            </div>
          </div>
          <div className="mono text-sm font-bold text-[var(--gold)]">{t.score} pts</div>
        </Link>
      ))}
    </div>
  );
}
