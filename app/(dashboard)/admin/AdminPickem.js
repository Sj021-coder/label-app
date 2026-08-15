"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PICKEM_STAKE, PICKEM_DEFAULT_COEFFICIENT } from "@/lib/gameRules";

export default function AdminPickem({ artists, predictions, radarSuggestions }) {
  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [artistAId, setArtistAId] = useState("");
  const [artistBId, setArtistBId] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [coefficient, setCoefficient] = useState(String(PICKEM_DEFAULT_COEFFICIENT));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Pre-fill the form from a real Radar signal — admin still edits & approves
  // every word before it's created. Nothing here publishes automatically.
  function applySuggestion(s) {
    setQuestion(s.question);
    setOptionA(s.optionA);
    setOptionB(s.optionB);
    setArtistAId(s.artistId || "");
    setArtistBId("");
    if (s.suggestedClosesAt) setClosesAt(s.suggestedClosesAt);
    document.getElementById("pickem-question-field")?.scrollIntoView({ behavior: "smooth" });
  }

  async function createPrediction() {
    setError("");
    setLoading(true);
    const res = await fetch("/api/pickem/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        optionA,
        optionB,
        artistAId: artistAId || null,
        artistBId: artistBId || null,
        closesAt,
        coefficient: Number(coefficient),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Erreur");
      return;
    }
    setQuestion("");
    setOptionA("");
    setOptionB("");
    setArtistAId("");
    setArtistBId("");
    setClosesAt("");
    setCoefficient(String(PICKEM_DEFAULT_COEFFICIENT));
    router.refresh();
  }

  async function resolve(predictionId, correctOption) {
    const res = await fetch("/api/pickem/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ predictionId, correctOption }),
    });
    if (res.ok) router.refresh();
  }

  const cote = Number(coefficient) || 0;
  const winPreview = cote > 1 ? Math.round(PICKEM_STAKE * (cote - 1)) : null;

  return (
    <div>
      {radarSuggestions?.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-bold text-[var(--text-faint)] uppercase mb-2">
            💡 Suggestions du Radar — actualité réelle, à toi de rédiger
          </div>
          <div className="space-y-2">
            {radarSuggestions.map((s) => (
              <div
                key={s.key}
                className="bg-[var(--surface-2)] border border-[var(--violet)]/40 rounded-xl p-3"
              >
                <div className="text-[11px] text-[var(--violet)] font-bold mb-0.5">
                  {s.tag}
                </div>
                <div className="text-sm mb-2">{s.raw}</div>
                <button
                  onClick={() => applySuggestion(s)}
                  className="text-xs font-bold text-[#1a1310] bg-[var(--gold)] rounded-lg px-3 py-1.5"
                >
                  Utiliser →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs font-bold text-[var(--text-faint)] uppercase mb-2">
        Créer un pick&apos;em
      </div>
      <div className="space-y-2.5 mb-5">
        <input
          id="pickem-question-field"
          type="text"
          placeholder="Question (ex: Qui aura le plus de streams cette semaine?)"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Option A"
            value={optionA}
            onChange={(e) => setOptionA(e.target.value)}
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm"
          />
          <input
            type="text"
            placeholder="Option B"
            value={optionB}
            onChange={(e) => setOptionB(e.target.value)}
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={artistAId}
            onChange={(e) => setArtistAId(e.target.value)}
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm"
          >
            <option value="">Lier artiste A (optionnel)</option>
            {artists.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <select
            value={artistBId}
            onChange={(e) => setArtistBId(e.target.value)}
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm"
          >
            <option value="">Lier artiste B (optionnel)</option>
            {artists.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-[var(--text-faint)] uppercase font-bold block mb-1">
              Verrou (deadline)
            </label>
            <input
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-faint)] uppercase font-bold block mb-1">
              Cote (coefficient)
            </label>
            <input
              type="number"
              step="0.1"
              min="1.1"
              value={coefficient}
              onChange={(e) => setCoefficient(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
        </div>
        {winPreview !== null && (
          <p className="text-[11px] text-[var(--text-faint)]">
            Mise fixe : {PICKEM_STAKE} pts. Bon pronostic → <span className="text-[var(--gold)] font-bold">+{winPreview} pts</span>.
            Mauvais → <span className="text-[var(--crimson)] font-bold">-{PICKEM_STAKE} pts</span>.
            Après le verrou, plus personne ne peut voter — perdu pour de bon.
          </p>
        )}
        {error && <p className="text-[var(--crimson)] text-xs">{error}</p>}
        <button
          onClick={createPrediction}
          disabled={loading || !question || !optionA || !optionB || !closesAt || cote <= 1}
          className="w-full bg-[var(--violet)] text-white font-extrabold uppercase tracking-wide text-sm rounded-xl py-2.5 disabled:opacity-40"
        >
          {loading ? "..." : "Créer le pick'em"}
        </button>
      </div>

      <div className="text-xs font-bold text-[var(--text-faint)] uppercase mb-2">
        Résoudre un pick&apos;em
      </div>
      {predictions.length === 0 ? (
        <div className="text-center text-[var(--text-faint)] text-sm py-3">Aucun pick&apos;em créé.</div>
      ) : (
        predictions.map((p) => (
          <div
            key={p.id}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 mb-2"
          >
            <div className="text-sm font-semibold mb-1">{p.question}</div>
            <div className="text-[10px] text-[var(--text-faint)] mb-2">Cote x{p.coefficient}</div>
            {p.correct_option ? (
              <div className="text-xs text-[var(--gold)]">
                Résolu : {p.correct_option === "A" ? p.option_a : p.option_b}
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => resolve(p.id, "A")}
                  className="flex-1 text-xs font-bold py-2 rounded-lg bg-[var(--surface-2)] text-[var(--text)]"
                >
                  {p.option_a} a gagné
                </button>
                <button
                  onClick={() => resolve(p.id, "B")}
                  className="flex-1 text-xs font-bold py-2 rounded-lg bg-[var(--surface-2)] text-[var(--text)]"
                >
                  {p.option_b} a gagné
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
