import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ArtistFace from "@/components/ArtistFace";
import { getBilanWindow } from "@/lib/weeklyProgram";
import { PICKEM_STAKE } from "@/lib/gameRules";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default async function BilanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("created_at, captain_artist_id")
    .eq("id", user.id)
    .single();

  const window = getBilanWindow(profile.created_at);

  if (!window.ready) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <div className="text-4xl mb-3">📊</div>
        <div className="display text-xl mb-2">Pas encore de bilan.</div>
        <p className="text-[var(--text-faint)] text-sm max-w-xs">
          Ton premier bilan arrive le {fmtDate(window.nextAt)} — une semaine complète depuis ton
          arrivée.
        </p>
      </div>
    );
  }

  const { periodStart, periodEnd } = window;
  const startISO = periodStart.toISOString();
  const endISO = periodEnd.toISOString();

  const { data: rosterRows } = await supabase
    .from("roster_entries")
    .select("artist_id, added_at, artists(name, initials, color, image_url)")
    .eq("user_id", user.id);
  const roster = (rosterRows || []).filter((r) => r.artists);
  const rosterIds = roster.map((r) => r.artist_id);

  const [{ data: weekEvents }, { data: picks }, { data: myLeague }] = await Promise.all([
    rosterIds.length
      ? supabase
          .from("score_events")
          .select("artist_id, delta, label, created_at")
          .in("artist_id", rosterIds)
          .gte("created_at", startISO)
          .lt("created_at", endISO)
      : Promise.resolve({ data: [] }),
    supabase
      .from("prediction_picks")
      .select("chosen_option, predictions(question, correct_option, coefficient, closes_at)")
      .eq("user_id", user.id),
    supabase.from("league_members").select("leagues(name, handle)").eq("user_id", user.id).limit(1).maybeSingle(),
  ]);

  const totalDelta = (weekEvents || []).reduce((s, e) => s + e.delta, 0);
  const perArtist = {};
  for (const e of weekEvents || []) {
    perArtist[e.artist_id] = (perArtist[e.artist_id] || 0) + e.delta;
  }
  const rankedRoster = roster
    .map((r) => ({ ...r, weekDelta: perArtist[r.artist_id] || 0 }))
    .sort((a, b) => b.weekDelta - a.weekDelta);
  const bestPick = rankedRoster[0];

  const captain = roster.find((r) => r.artist_id === profile.captain_artist_id);
  const captainDelta = captain ? perArtist[captain.artist_id] || 0 : 0;

  const tradedThisWeek = roster.some(
    (r) => new Date(r.added_at) >= periodStart && new Date(r.added_at) < periodEnd
  );

  const resolvedPicks = (picks || []).filter(
    (p) =>
      p.predictions?.correct_option &&
      new Date(p.predictions.closes_at) >= periodStart &&
      new Date(p.predictions.closes_at) < periodEnd
  );
  let pickemPoints = 0;
  let pickemWins = 0;
  for (const p of resolvedPicks) {
    const coef = Number(p.predictions.coefficient) || 2;
    const won = p.chosen_option === p.predictions.correct_option;
    const winDelta = Math.round(PICKEM_STAKE * (coef - 1));
    pickemPoints += won ? winDelta : -Math.round((2 / 3) * winDelta);
    if (won) pickemWins++;
  }

  return (
    <div className="pb-10">
      <div className="text-center pt-2 pb-5">
        <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-1">
          {fmtDate(periodStart)} → {fmtDate(periodEnd)}
        </div>
        <div className="display text-2xl">
          Ton <span className="text-[var(--violet)]">bilan</span>.
        </div>
      </div>

      <div className="bg-gradient-to-br from-[var(--surface)] to-[var(--bg-alt)] border border-[var(--border)] rounded-2xl p-5 mb-5 text-center">
        <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-1">
          Ton label cette semaine
        </div>
        <div
          className={`display text-4xl mb-1 ${
            totalDelta >= 0 ? "text-[var(--gold)]" : "text-[var(--crimson)]"
          }`}
        >
          {totalDelta >= 0 ? "+" : ""}
          {totalDelta}
        </div>
        {bestPick && bestPick.weekDelta !== 0 && (
          <div className="text-xs text-[var(--text-muted)]">
            Meilleur pick :{" "}
            <span className="font-bold text-[var(--text)]">{bestPick.artists.name}</span> (
            {bestPick.weekDelta >= 0 ? "+" : ""}
            {bestPick.weekDelta})
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3.5">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-2">
            🧢 Capitaine
          </div>
          {captain ? (
            <div className="flex items-center gap-2">
              <ArtistFace
                imageUrl={captain.artists.image_url}
                initials={captain.artists.initials}
                color={captain.artists.color}
                name={captain.artists.name}
                size={28}
              />
              <div>
                <div className="text-xs font-bold">{captain.artists.name}</div>
                <div className="mono text-[11px] text-[var(--gold)]">
                  {captainDelta >= 0 ? "+" : ""}
                  {captainDelta} ×2
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-[var(--text-faint)]">Aucun capitaine nommé</div>
          )}
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3.5">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-2">
            🔁 Transfert
          </div>
          <div className="text-xs">
            {tradedThisWeek ? (
              <span className="text-[var(--gold)] font-bold">✓ Fait cette semaine</span>
            ) : (
              <span className="text-[var(--text-faint)]">Pas de transfert</span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3.5 mb-5">
        <div className="text-[10px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-2">
          🔮 Pronostics
        </div>
        {resolvedPicks.length === 0 ? (
          <div className="text-xs text-[var(--text-faint)]">Aucun pronostic résolu cette semaine</div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)]">
              {pickemWins}/{resolvedPicks.length} gagnés
            </span>
            <span
              className={`mono text-sm font-bold ${
                pickemPoints >= 0 ? "text-[var(--gold)]" : "text-[var(--crimson)]"
              }`}
            >
              {pickemPoints >= 0 ? "+" : ""}
              {pickemPoints} pts
            </span>
          </div>
        )}
      </div>

      {myLeague?.leagues && (
        <Link
          href={`/league/${myLeague.leagues.handle}`}
          className="block bg-[var(--surface)] border border-[var(--violet)]/40 rounded-2xl p-3.5 mb-5"
        >
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-1">
            🏆 Ta ligue
          </div>
          <div className="text-sm font-semibold">{myLeague.leagues.name} →</div>
        </Link>
      )}

      <div className="grid grid-cols-4 gap-2 mt-2">
        {rankedRoster.map((r) => (
          <div key={r.artist_id} className="text-center">
            <div className="aspect-square rounded-full overflow-hidden mb-1 mx-auto w-11">
              <ArtistFace
                imageUrl={r.artists.image_url}
                initials={r.artists.initials}
                color={r.artists.color}
                name={r.artists.name}
                size="100%"
              />
            </div>
            <div
              className={`mono text-[10px] font-bold ${
                r.weekDelta >= 0 ? "text-[var(--gold)]" : "text-[var(--crimson)]"
              }`}
            >
              {r.weekDelta >= 0 ? "+" : ""}
              {r.weekDelta}
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-[11px] text-[var(--text-faint)] mt-6">
        Prochain bilan le {fmtDate(new Date(periodEnd.getTime() + 7 * 86400000))}.
      </p>
    </div>
  );
}
