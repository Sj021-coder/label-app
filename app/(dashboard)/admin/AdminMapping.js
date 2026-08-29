"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Unmapped artists first (nothing to gain re-checking an already-mapped
// one), then by tier (S/A matter most — they're who most people draft and
// who the automated engine has the biggest impact on), alphabetical within
// a tier. Was plain alphabetical order before, which buried the highest-
// priority unmapped Tier S/A artists anywhere in a 100-artist list.
const TIER_PRIORITY = { S: 0, A: 1, B: 2, C: 3 };
function prioritize(artists) {
  return [...artists].sort((a, b) => {
    const aMapped = !!(a.spotify_id || a.youtube_channel_id);
    const bMapped = !!(b.spotify_id || b.youtube_channel_id);
    if (aMapped !== bMapped) return aMapped ? 1 : -1;
    const aTier = TIER_PRIORITY[a.tier] ?? 4;
    const bTier = TIER_PRIORITY[b.tier] ?? 4;
    if (aTier !== bTier) return aTier - bTier;
    return a.name.localeCompare(b.name);
  });
}

export default function AdminMapping({ artists, newsItems }) {
  const prioritized = prioritize(artists);
  const [selectedId, setSelectedId] = useState(prioritized[0]?.id || "");
  const [spotifyResults, setSpotifyResults] = useState([]);
  const [youtubeResults, setYoutubeResults] = useState([]);
  const [loadingSpotify, setLoadingSpotify] = useState(false);
  const [loadingYoutube, setLoadingYoutube] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [manualSpotifyId, setManualSpotifyId] = useState("");
  const [manualYoutubeId, setManualYoutubeId] = useState("");
  const [mapConfirmation, setMapConfirmation] = useState(null); // { name, genres }
  const router = useRouter();

  const selected = artists.find((a) => a.id === selectedId);
  const filtered = prioritized.filter((a) =>
    a.name.toLowerCase().includes(filter.toLowerCase())
  );

  const unmappedPriority = artists.filter(
    (a) => !a.spotify_id && !a.youtube_channel_id && (a.tier === "S" || a.tier === "A")
  ).length;

  async function searchSpotify() {
    setError("");
    setLoadingSpotify(true);
    const res = await fetch("/api/admin/spotify-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: selected.name }),
    });
    setLoadingSpotify(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Erreur Spotify");
      return;
    }
    const data = await res.json();
    setSpotifyResults(data.results || []);
  }

  async function searchYoutube() {
    setError("");
    setLoadingYoutube(true);
    const res = await fetch("/api/admin/youtube-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: selected.name }),
    });
    setLoadingYoutube(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Erreur YouTube");
      return;
    }
    const data = await res.json();
    setYoutubeResults(data.results || []);
  }

  async function assignSpotify(spotifyId) {
    const res = await fetch("/api/admin/save-artist-ids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artistId: selectedId, spotifyId }),
    });
    const data = await res.json().catch(() => ({}));
    setSpotifyResults([]);
    setManualSpotifyId("");
    // No automated "is this a mismatch" judgment here on purpose — a first
    // attempt at one turned out unreliable both ways: it would have missed
    // the real Black M / black midi mix-up (both names share the word
    // "black"), and separately flagged a genuinely correct match ("Blacko"
    // vs Spotify's own "Blacko (Sniper)") as suspicious. Rather than cry
    // wolf or give false confidence, this just shows exactly what got
    // saved — reading it is the real safeguard, not a keyword guess.
    if (data.mappedTo) setMapConfirmation(data.mappedTo);
    router.refresh();
  }

  async function assignYoutube(youtubeChannelId) {
    await fetch("/api/admin/save-artist-ids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artistId: selectedId, youtubeChannelId }),
    });
    setYoutubeResults([]);
    setManualYoutubeId("");
    router.refresh();
  }

  // Removes a mapping entirely — for when no confident match exists (e.g.
  // Aden, Djame from the audit) and leaving it unmapped is honestly better
  // than guessing wrong. Same endpoint, just null instead of an ID.
  async function clearSpotify() {
    setMapConfirmation(null);
    await assignSpotify(null);
  }
  async function clearYoutube() {
    await assignYoutube(null);
  }

  async function markReviewed(newsId) {
    await fetch("/api/admin/mark-news-reviewed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newsId }),
    });
    router.refresh();
  }

  const mappedCount = artists.filter((a) => a.spotify_id || a.youtube_channel_id).length;

  return (
    <div>
      <p className="text-xs text-[var(--text-faint)] mb-1">
        {mappedCount}/{artists.length} artistes ont au moins un ID assigné.
      </p>
      <p className="text-xs mb-3">
        {unmappedPriority > 0 ? (
          <span className="text-[var(--crimson)] font-bold">
            ⚠️ {unmappedPriority} artiste{unmappedPriority > 1 ? "s" : ""} prioritaire
            {unmappedPriority > 1 ? "s" : ""} (Tier S/A) sans ID — la liste ci-dessous les
            place en premier.
          </span>
        ) : (
          <span className="text-[var(--gold)] font-bold">
            ✅ Tous les artistes Tier S/A sont mappés.
          </span>
        )}
      </p>

      <input
        type="text"
        placeholder="Filtrer les artistes..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm mb-2"
      />
      <select
        value={selectedId}
        onChange={(e) => {
          setSelectedId(e.target.value);
          setSpotifyResults([]);
          setYoutubeResults([]);
          setManualSpotifyId("");
          setManualYoutubeId("");
          setMapConfirmation(null);
        }}
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm mb-3"
      >
        {filtered.map((a) => (
          <option key={a.id} value={a.id}>
            [{a.tier || "?"}] {a.name} {a.spotify_id ? "🎵" : ""} {a.youtube_channel_id ? "▶️" : ""}
          </option>
        ))}
      </select>

      {/* Current mapping status + a way to actually remove one — didn't
          exist before. Needed for cases like Aden/Djame from the audit,
          where no confident match exists and unmapped is honestly better
          than a guessed wrong one. */}
      {selected && (selected.spotify_id || selected.youtube_channel_id) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selected.spotify_id && (
            <button
              onClick={clearSpotify}
              className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-[var(--surface-2)] text-[var(--text-faint)]"
            >
              🎵 Mappé · ✕ Retirer
            </button>
          )}
          {selected.youtube_channel_id && (
            <button
              onClick={clearYoutube}
              className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-[var(--surface-2)] text-[var(--text-faint)]"
            >
              ▶️ Mappé · ✕ Retirer
            </button>
          )}
        </div>
      )}

      {error && <p className="text-[var(--crimson)] text-xs mb-2">{error}</p>}

      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={searchSpotify}
          disabled={loadingSpotify}
          className="text-xs font-bold py-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--text)]"
        >
          {loadingSpotify ? "..." : "Chercher sur Spotify"}
        </button>
        <button
          onClick={searchYoutube}
          disabled={loadingYoutube}
          className="text-xs font-bold py-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--text)]"
        >
          {loadingYoutube ? "..." : "Chercher sur YouTube"}
        </button>
      </div>

      {/* Manual paste — for when the search above returns decoys (fan
          channels, tribute accounts, unrelated artists with the same
          stage name) instead of the real one. Same save-artist-ids
          endpoint as clicking a search result, just a direct ID instead. */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 mb-3">
        <div className="text-[11px] text-[var(--text-faint)] uppercase font-bold mb-2">
          Ou coller un ID vérifié directement
        </div>
        <div className="flex gap-1.5 mb-1.5">
          <input
            type="text"
            placeholder="Spotify artist ID"
            value={manualSpotifyId}
            onChange={(e) => setManualSpotifyId(e.target.value.trim())}
            className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs"
          />
          <button
            onClick={() => manualSpotifyId && assignSpotify(manualSpotifyId)}
            disabled={!manualSpotifyId}
            className="text-[11px] font-bold px-3 rounded-lg bg-[var(--gold-soft)] text-[var(--gold)] disabled:opacity-40"
          >
            OK
          </button>
        </div>
        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder="YouTube channel ID (UC...)"
            value={manualYoutubeId}
            onChange={(e) => setManualYoutubeId(e.target.value.trim())}
            className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs"
          />
          <button
            onClick={() => manualYoutubeId && assignYoutube(manualYoutubeId)}
            disabled={!manualYoutubeId}
            className="text-[11px] font-bold px-3 rounded-lg bg-[var(--gold-soft)] text-[var(--gold)] disabled:opacity-40"
          >
            OK
          </button>
        </div>
      </div>

      {/* Confirms exactly what got saved — visible the instant a mapping
          is made, not days later when a wrong artist's data shows up on
          Radar (which is exactly how the Blacko/Black M mismatches went
          unnoticed originally). Deliberately neutral, no automated
          right/wrong judgment — read it yourself, that's the real check. */}
      {mapConfirmation && (
        <div className="rounded-xl px-3 py-2.5 mb-3 text-xs border bg-[var(--surface-2)] border-[var(--border)]">
          <div className="font-bold text-[var(--text)]">Mappé à : {mapConfirmation.name}</div>
          {mapConfirmation.genres?.length > 0 && (
            <div className="text-[var(--text-faint)] mt-0.5">{mapConfirmation.genres.slice(0, 4).join(", ")}</div>
          )}
        </div>
      )}

      {spotifyResults.length > 0 && (
        <div className="mb-3">
          <div className="text-[11px] text-[var(--text-faint)] uppercase font-bold mb-1.5">
            Résultats Spotify
          </div>
          {/* Photo + genres shown here on purpose — name and follower count
              alone once let "Black M" get saved as a UK rock band and
              "Kikesa" as a Canadian house singer. A glance at the face and
              "rock, experimental" vs "french hip hop" catches that a
              plain popularity number never will. */}
          {spotifyResults.map((r) => (
            <button
              key={r.id}
              onClick={() => assignSpotify(r.id)}
              className="w-full text-left bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 mb-1.5 text-xs flex items-center gap-2.5"
            >
              {r.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.image} alt={r.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold">{r.name}</div>
                <div className="text-[var(--text-faint)] truncate">
                  {r.genres?.length > 0 ? r.genres.slice(0, 3).join(", ") : "genre non précisé"} ·{" "}
                  {r.followers?.toLocaleString()} followers
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {youtubeResults.length > 0 && (
        <div className="mb-3">
          <div className="text-[11px] text-[var(--text-faint)] uppercase font-bold mb-1.5">
            Résultats YouTube
          </div>
          {youtubeResults.map((r) => (
            <button
              key={r.channelId}
              onClick={() => assignYoutube(r.channelId)}
              className="w-full text-left bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 mb-1.5 text-xs"
            >
              <span className="font-bold">{r.title}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 pt-5 border-t border-[var(--border)]">
        <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-2">
          File d&apos;actualités (non-vues)
        </div>
        {newsItems.length === 0 ? (
          <div className="text-center text-[var(--text-faint)] text-sm py-3">
            Aucune actualité en attente.
          </div>
        ) : (
          newsItems.map((n) => (
            <div
              key={n.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 mb-2"
            >
              <div className="text-xs font-bold mb-1">{n.artists?.name}</div>
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--text)] underline block mb-1.5"
              >
                {n.title}
              </a>
              {n.source && (
                <div className="text-[11px] text-[var(--text-faint)] mb-2">{n.source}</div>
              )}
              <button
                onClick={() => markReviewed(n.id)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[var(--surface-2)] text-[var(--text-faint)]"
              >
                Marquer comme vu
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
