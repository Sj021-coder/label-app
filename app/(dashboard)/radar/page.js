import { createClient } from "@/lib/supabase/server";
import ArtistFace from "@/components/ArtistFace";

export default async function RadarPage() {
  const supabase = await createClient();

  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setUTCDate(now.getUTCDate() - mondayOffset);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const { data: award } = await supabase
    .from("weekly_awards")
    .select("value, artists(name, initials, color, image_url)")
    .eq("award_type", "most_momentum")
    .eq("week_start", weekStartStr)
    .single();

  const { data: upcoming } = await supabase
    .from("upcoming_releases")
    .select("id, title, scheduled_at, video_url, artists(name, initials, color, image_url)")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(15);

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("score_events")
    .select("id, label, delta, category, created_at, artists(name, initials, color, image_url)")
    .in("category", ["activity", "culture"])
    .gte("created_at", fourteenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div>
      <div className="text-center pt-2 pb-4">
        <div className="display text-2xl mb-1">
          Release <span className="text-[var(--gold)]">Radar</span>
        </div>
        <p className="text-[var(--text-faint)] text-xs">
          Ce qui arrive, et ce qui vient de sortir.
        </p>
      </div>

      {award?.artists && (
        <div className="flex items-center gap-3 bg-[var(--gold-soft)] border border-[var(--gold)] rounded-2xl px-4 py-3.5 mb-6">
          <ArtistFace
            imageUrl={award.artists.image_url}
            initials={award.artists.initials}
            color={award.artists.color}
            name={award.artists.name}
            size={44}
          />
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wide text-[var(--gold)] font-bold mb-0.5">
              🚀 Plus grosse progression cette semaine
            </div>
            <div className="text-sm font-bold">{award.artists.name}</div>
          </div>
          <div className="mono text-sm font-bold text-[var(--gold)]">+{award.value}</div>
        </div>
      )}

      <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-3">
        À venir
      </div>
      {(!upcoming || upcoming.length === 0) && (
        <div className="text-center text-[var(--text-faint)] text-sm py-4 mb-6">
          Rien d&apos;annoncé pour le moment.
        </div>
      )}
      {upcoming?.map((u) => {
        const daysAway = Math.ceil(
          (new Date(u.scheduled_at) - new Date()) / (1000 * 60 * 60 * 24)
        );
        return (
          <a
            key={u.id}
            href={u.video_url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--violet)] rounded-2xl px-3.5 py-3 mb-2.5"
          >
            <ArtistFace
              imageUrl={u.artists?.image_url}
              initials={u.artists?.initials}
              color={u.artists?.color}
              name={u.artists?.name}
              size={40}
            />
            <div className="flex-1">
              <div className="text-xs font-bold text-[var(--violet)] mb-0.5">
                {u.artists?.name}
              </div>
              <div className="text-sm font-semibold leading-tight">{u.title}</div>
            </div>
            <div className="text-[11px] font-bold text-[var(--violet)] whitespace-nowrap">
              {daysAway <= 0 ? "Aujourd'hui" : `Dans ${daysAway}j`}
            </div>
          </a>
        );
      })}

      <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-3 mt-6">
        Vient de sortir
      </div>
      {(!recent || recent.length === 0) && (
        <div className="text-center text-[var(--text-faint)] text-sm py-4">
          Rien de nouveau ces 2 dernières semaines.
        </div>
      )}
      {recent?.map((ev) => (
        <div
          key={ev.id}
          className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-3.5 py-3 mb-2"
        >
          <ArtistFace
            imageUrl={ev.artists?.image_url}
            initials={ev.artists?.initials}
            color={ev.artists?.color}
            name={ev.artists?.name}
            size={36}
          />
          <div className="flex-1">
            <div className="text-xs font-bold mb-0.5">{ev.artists?.name}</div>
            <div className="text-sm">{ev.label}</div>
          </div>
          <span
            className={`mono text-xs font-bold whitespace-nowrap ${
              ev.delta >= 0 ? "text-[var(--gold)]" : "text-[var(--crimson)]"
            }`}
          >
            {ev.delta >= 0 ? "+" : ""}
            {ev.delta}
          </span>
        </div>
      ))}
    </div>
  );
}
