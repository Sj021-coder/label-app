import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSharedWeek } from "@/lib/weeklyProgram";

const DAY = 24 * 3600 * 1000;

function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default async function TeamRecapPage({ params }) {
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

  // The most recently COMPLETED shared week — not the one still running.
  const { start: currentWeekStart } = getSharedWeek();
  const recapStart = new Date(currentWeekStart.getTime() - 7 * DAY);
  const recapEnd = currentWeekStart;

  const { data: memberRows } = await supabase
    .from("team_members")
    .select("user_id, profiles(username)")
    .eq("team_id", team.id);
  const members = (memberRows || []).filter((m) => m.profiles);

  let perMember = [];
  let totalDelta = 0;
  if (members.length) {
    const rosterByUser = {};
    const { data: rosterRows } = await supabase
      .from("roster_entries")
      .select("user_id, artist_id")
      .in("user_id", members.map((m) => m.user_id));
    for (const r of rosterRows || []) (rosterByUser[r.user_id] ||= []).push(r.artist_id);

    const allArtistIds = [...new Set((rosterRows || []).map((r) => r.artist_id))];
    let events = [];
    if (allArtistIds.length) {
      const { data } = await supabase
        .from("score_events")
        .select("artist_id, delta")
        .in("artist_id", allArtistIds)
        .gte("created_at", recapStart.toISOString())
        .lt("created_at", recapEnd.toISOString());
      events = data || [];
    }
    const deltaByArtist = {};
    for (const e of events) deltaByArtist[e.artist_id] = (deltaByArtist[e.artist_id] || 0) + e.delta;

    perMember = members
      .map((m) => {
        const delta = (rosterByUser[m.user_id] || []).reduce((s, aid) => s + (deltaByArtist[aid] || 0), 0);
        return { username: m.profiles.username, userId: m.user_id, delta };
      })
      .sort((a, b) => b.delta - a.delta);
    totalDelta = perMember.reduce((s, m) => s + m.delta, 0);
  }

  const mvp = perMember[0];

  const { data: duelRows } = await supabase
    .from("team_duels")
    .select("*")
    .or(`team_a_id.eq.${team.id},team_b_id.eq.${team.id}`)
    .gte("week_end", recapEnd.toISOString())
    .lt("week_end", new Date(recapEnd.getTime() + DAY).toISOString())
    .limit(1);
  const lastDuel = duelRows?.[0] || null;

  return (
    <div className="min-h-screen px-5 pt-8 pb-10 max-w-md mx-auto text-center">
      <Link href={`/team/${team.handle}`} className="text-xs text-[var(--text-faint)] mb-4 inline-block">
        ← {team.name}
      </Link>
      <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-1">
        {fmtDate(recapStart)} → {fmtDate(recapEnd)}
      </div>
      <div className="display text-2xl mb-6">
        Le bilan de <span style={{ color: team.color }}>{team.name}</span>
      </div>

      <div className="bg-gradient-to-br from-[var(--surface)] to-[var(--bg-alt)] border border-[var(--border)] rounded-2xl p-5 mb-5">
        <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-1">
          Progression de l&apos;équipe
        </div>
        <div className={`display text-4xl ${totalDelta >= 0 ? "text-[var(--gold)]" : "text-[var(--crimson)]"}`}>
          {totalDelta >= 0 ? "+" : ""}
          {totalDelta}
        </div>
      </div>

      {mvp && (
        <div className="bg-[var(--surface)] border border-[var(--gold)]/40 rounded-2xl p-4 mb-5">
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-1">
            🌟 MVP de la semaine
          </div>
          <div className="text-lg font-bold">{mvp.username}</div>
          <div className="mono text-sm text-[var(--gold)]">
            {mvp.delta >= 0 ? "+" : ""}
            {mvp.delta} pts
          </div>
        </div>
      )}

      {lastDuel && (
        <div className="bg-[var(--surface)] border border-[var(--violet)]/40 rounded-2xl p-4 mb-5">
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-1">
            ⚔️ Résultat du duel
          </div>
          <div className="text-sm text-[var(--text-muted)]">Duel terminé cette semaine-là.</div>
        </div>
      )}

      <div className="text-left mt-6">
        <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-2">
          Contribution de chacun
        </div>
        {perMember.map((m) => (
          <div key={m.userId} className="flex justify-between py-2 border-b border-[var(--border)] text-sm">
            <span>{m.username}</span>
            <span className={`mono font-bold ${m.delta >= 0 ? "text-[var(--gold)]" : "text-[var(--crimson)]"}`}>
              {m.delta >= 0 ? "+" : ""}
              {m.delta}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
