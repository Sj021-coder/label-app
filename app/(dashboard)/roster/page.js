import { createClient } from "@/lib/supabase/server";
import VinylAvatar from "@/components/VinylAvatar";
import Link from "next/link";

export default async function RosterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rosterRows } = await supabase
    .from("roster_entries")
    .select("artist_id, artists(id, name, initials, color, score)")
    .eq("user_id", user.id);

  const roster = (rosterRows || []).map((r) => r.artists).filter(Boolean);
  const rosterIds = roster.map((a) => a.id);

  let recentEvents = [];
  if (rosterIds.length > 0) {
    const { data } = await supabase
      .from("score_events")
      .select("id, label, delta, created_at, artist_id, artists(name)")
      .in("artist_id", rosterIds)
      .order("created_at", { ascending: false })
      .limit(8);
    recentEvents = data || [];
  }

  const slots = [...roster];
  while (slots.length < 5) slots.push(null);

  return (
    <div>
      <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-3">
        Mon roster ({roster.length}/5)
      </div>
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        {slots.map((artist, i) =>
          artist ? (
            <div
              key={artist.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-2.5"
            >
              <div className="mb-2">
                <VinylAvatar initials={artist.initials} color={artist.color} size={"100%"} />
              </div>
              <div className="text-xs font-bold mb-1 leading-tight">{artist.name}</div>
              <div
                className={`text-xs font-bold ${
                  artist.score >= 0 ? "text-[var(--gold)]" : "text-[var(--crimson)]"
                }`}
              >
                {artist.score >= 0 ? "▲" : "▼"} {Math.abs(artist.score)}
              </div>
            </div>
          ) : (
            <Link
              key={"empty-" + i}
              href="/draft"
              className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl p-2.5 flex flex-col items-center justify-center min-h-[118px] text-[var(--text-faint)]"
            >
              <div className="text-xl mb-1">+</div>
              <div className="text-[11px]">Ajouter</div>
            </Link>
          )
        )}
      </div>

      <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-3">
        Derniers évènements
      </div>
      {recentEvents.length === 0 ? (
        <div className="text-center text-[var(--text-faint)] text-sm py-6">
          {roster.length === 0
            ? "Ajoute des artistes à ton roster pour voir leur activité."
            : "Aucun évènement encore pour ton roster."}
        </div>
      ) : (
        <div>
          {recentEvents.map((ev) => (
            <div
              key={ev.id}
              className="flex justify-between py-2 border-b border-[var(--border)] text-[13px]"
            >
              <span className="text-[var(--text-muted)]">
                <span className="font-semibold text-[var(--text)]">{ev.artists?.name}</span> —{" "}
                {ev.label}
              </span>
              <span
                className={`mono font-bold ${
                  ev.delta >= 0 ? "text-[var(--gold)]" : "text-[var(--crimson)]"
                }`}
              >
                {ev.delta >= 0 ? "+" : ""}
                {ev.delta}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
