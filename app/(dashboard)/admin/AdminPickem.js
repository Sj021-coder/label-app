"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminPickem({ artists, predictions }) {
  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [artistAId, setArtistAId] = useState("");
  const [artistBId, setArtistBId] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

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

  return (
    <div>
      <div className="text-xs font-bold text-[var(--text-faint)] uppercase mb-2">
        Créer un pick&apos;em
      </div>
      <div className="space-y-2.5 mb-5">
        <input
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
        <input
          type="datetime-local"
          value={closesAt}
          onChange={(e) => setClosesAt(e.target.value)}
          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm"
        />
        {error && <p className="text-[var(--crimson)] text-xs">{error}</p>}
        <button
          onClick={createPrediction}
          disabled={loading || !question || !optionA || !optionB || !closesAt}
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
            <div className="text-sm font-semibold mb-2">{p.question}</div>
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
