import ArtistFace from "@/components/ArtistFace";

// The "actu" half of the Thursday moment — general, not personal: what
// happened to the whole pool this week, what's coming. Distinct from Radar's
// continuously-updating feed — this is a once-a-week, deliberately batched
// recap, same real data, different rhythm.
export default function WeeklyDigest({ movers, upcoming, news }) {
  return (
    <div className="mb-7">
      <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-1">
        📅 Cette semaine
      </div>
      <p className="text-xs text-[var(--text-faint)] mb-3">
        Le récap général — pas ton label, tout le monde.
      </p>

      {movers.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {movers.map((m) => (
            <div
              key={m.artist.name}
              className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-2.5 py-2"
            >
              <ArtistFace
                imageUrl={m.artist.image_url}
                initials={m.artist.initials}
                color={m.artist.color}
                name={m.artist.name}
                size={28}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold truncate">{m.artist.name}</div>
                <div
                  className={`mono text-[10px] font-bold ${
                    m.sum >= 0 ? "text-[var(--gold)]" : "text-[var(--crimson)]"
                  }`}
                >
                  {m.sum >= 0 ? "+" : ""}
                  {m.sum} cette semaine
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mb-3">
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-1.5">
            À venir
          </div>
          {upcoming.map((u) => (
            <div key={u.id} className="text-xs text-[var(--text-muted)] mb-1">
              🎵 <span className="font-semibold text-[var(--text)]">{u.artists?.name}</span> —{" "}
              {u.title}
            </div>
          ))}
        </div>
      )}

      {news.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-1.5">
            Actu rap
          </div>
          {news.map((n) => (
            <a
              key={n.id}
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-[var(--text-muted)] mb-1 underline decoration-[var(--border)]"
            >
              {n.title}
            </a>
          ))}
        </div>
      )}

      {movers.length === 0 && upcoming.length === 0 && news.length === 0 && (
        <div className="text-center text-[var(--text-faint)] text-sm py-4">
          Rien à signaler cette semaine.
        </div>
      )}
    </div>
  );
}
