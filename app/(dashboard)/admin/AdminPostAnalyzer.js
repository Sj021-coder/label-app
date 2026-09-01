"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { extractSignal, suggestScoring } from "@/lib/signals/extractSignal";
import { CATEGORIES } from "@/lib/scoringEvents";

// The "semi-automated" path discussed for sources with no free API
// (Instagram/TikTok accounts like RapFrInfos): a human spots the post —
// nobody else can, those platforms don't expose arbitrary accounts to
// outside apps — but everything AFTER "I saw something interesting" is
// the same automated understanding built for news articles. Paste the
// caption, it's read the same way, a human still confirms before anything
// is saved — the parser suggests, it never applies blind.
export default function AdminPostAnalyzer({ artists }) {
  const [text, setText] = useState("");
  const [signal, setSignal] = useState(null);
  const [artistId, setArtistId] = useState(artists[0]?.id || "");
  const [category, setCategory] = useState(CATEGORIES[0].key);
  const [delta, setDelta] = useState(0);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(false);
  const router = useRouter();

  function handleAnalyze() {
    setApplied(false);
    setError("");
    const sig = extractSignal(text);
    const suggestion = suggestScoring(sig);
    setSignal(sig);
    setCategory(suggestion.category);
    setDelta(suggestion.delta);
    setLabel(suggestion.label);
  }

  async function handleApply() {
    if (!artistId || !label.trim()) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/score-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artistId,
        eventKey: "custom",
        customDelta: delta,
        customCategory: category,
        reason: label,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Erreur");
      return;
    }
    setApplied(true);
    setText("");
    setSignal(null);
    setLabel("");
    router.refresh();
  }

  const typeInfo = {
    milestone: { emoji: "🎯", text: "Palier de streams détecté" },
    announcement: { emoji: "📢", text: "Annonce détectée" },
    unknown: { emoji: "🤷", text: "Rien de reconnu — remplis à la main ci-dessous" },
  };

  return (
    <div>
      <p className="text-xs text-[var(--text-faint)] mb-3">
        Colle le texte d&apos;un post (Instagram, TikTok, actu...) que tu as vu passer. C&apos;est
        toi qui repères le post — le reste (comprendre ce qu&apos;il dit, l&apos;appliquer au
        score) peut être automatique.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='Ex : Ninho : « La vie qu&apos;on mène » passe les 100M de streams sur Spotify'
        rows={3}
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm mb-2"
      />

      <button
        onClick={handleAnalyze}
        disabled={!text.trim()}
        className="w-full text-xs font-bold py-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--text)] disabled:opacity-40 mb-3"
      >
        Analyser
      </button>

      {signal && (
        <>
          <div className="text-xs font-bold mb-3 text-[var(--violet)]">
            {typeInfo[signal.type].emoji} {typeInfo[signal.type].text}
          </div>

          <div className="mb-3">
            <label className="block text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-1.5">
              Artiste concerné
            </label>
            <select
              value={artistId}
              onChange={(e) => setArtistId(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm"
            >
              {artists.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-1.5">
                Catégorie
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-1.5">
                Points (+/-)
              </label>
              <input
                type="number"
                value={delta}
                onChange={(e) => setDelta(Number(e.target.value))}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-1.5">
              Explication affichée
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Vérifie/corrige avant d'appliquer"
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm"
            />
          </div>

          {error && <p className="text-[var(--crimson)] text-xs mb-2">{error}</p>}

          <button
            onClick={handleApply}
            disabled={loading || !label.trim()}
            className="w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3 disabled:opacity-60"
          >
            {loading ? "..." : "Appliquer"}
          </button>
        </>
      )}

      {applied && <p className="text-[var(--gold)] text-xs mt-2 font-bold">✓ Appliqué avec succès.</p>}
    </div>
  );
}
