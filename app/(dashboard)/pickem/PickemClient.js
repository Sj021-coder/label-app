"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PickemClient({ predictions, myPicks, pickemScore }) {
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState("");
  const router = useRouter();

  const myPickMap = Object.fromEntries(myPicks.map((p) => [p.prediction_id, p.chosen_option]));

  async function vote(predictionId, chosenOption) {
    setError("");
    setLoadingId(predictionId);
    const res = await fetch("/api/pickem/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ predictionId, chosenOption }),
    });
    setLoadingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Erreur");
      return;
    }
    router.refresh();
  }

  const open = predictions.filter((p) => !p.correct_option && new Date(p.closes_at) > new Date());
  const closed = predictions.filter((p) => p.correct_option || new Date(p.closes_at) <= new Date());

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold">
          Pick&apos;em
        </div>
        <div className="mono text-sm font-bold text-[var(--gold)]">{pickemScore} pts</div>
      </div>

      {error && <p className="text-[var(--crimson)] text-xs mb-3">{error}</p>}

      <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-2">
        En cours
      </div>
      {open.length === 0 ? (
        <div className="text-center text-[var(--text-faint)] text-sm py-4 mb-4">
          Aucun pick&apos;em ouvert pour le moment.
        </div>
      ) : (
        open.map((p) => {
          const myPick = myPickMap[p.id];
          return (
            <div
              key={p.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3.5 mb-3"
            >
              <div className="text-sm font-semibold mb-3">{p.question}</div>
              <div className="grid grid-cols-2 gap-2">
                {["A", "B"].map((opt) => {
                  const label = opt === "A" ? p.option_a : p.option_b;
                  const isPicked = myPick === opt;
                  return (
                    <button
                      key={opt}
                      disabled={!!myPick || loadingId === p.id}
                      onClick={() => vote(p.id, opt)}
                      className={`text-sm font-bold py-3 rounded-xl border ${
                        isPicked
                          ? "bg-[var(--gold)] text-[#1a1310] border-[var(--gold)]"
                          : myPick
                          ? "bg-[var(--surface-2)] text-[var(--text-faint)] border-[var(--border)]"
                          : "bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)]"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {myPick && (
                <div className="text-[11px] text-[var(--text-faint)] mt-2">
                  Ton pick est enregistré — résultat bientôt.
                </div>
              )}
            </div>
          );
        })
      )}

      <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-2 mt-6">
        Résultats
      </div>
      {closed.length === 0 ? (
        <div className="text-center text-[var(--text-faint)] text-sm py-4">
          Aucun résultat encore.
        </div>
      ) : (
        closed.map((p) => {
          const myPick = myPickMap[p.id];
          const won = p.correct_option && myPick === p.correct_option;
          return (
            <div
              key={p.id}
              className="flex justify-between items-center bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 mb-2"
            >
              <div>
                <div className="text-sm font-semibold">{p.question}</div>
                <div className="text-xs text-[var(--text-faint)]">
                  {p.correct_option
                    ? `Réponse : ${p.correct_option === "A" ? p.option_a : p.option_b}`
                    : "En attente de résolution"}
                </div>
              </div>
              {p.correct_option && myPick && (
                <span
                  className={`text-xs font-bold ${
                    won ? "text-[var(--gold)]" : "text-[var(--crimson)]"
                  }`}
                >
                  {won ? "+10" : "Raté"}
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
