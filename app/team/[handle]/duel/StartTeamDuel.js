"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartTeamDuel({ teamId, eligibleTeams }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);

  async function start(mode, opponentTeamId) {
    setError("");
    setLoading(true);
    const res = await fetch("/api/team-duel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, mode, opponentTeamId }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Erreur");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={() => start("random")}
        disabled={loading}
        className="w-full bg-[var(--violet)] text-white font-extrabold uppercase tracking-wide text-sm rounded-xl py-3.5 mb-2 disabled:opacity-60"
      >
        {loading ? "…" : "🎲 Adversaire aléatoire"}
      </button>
      <button
        type="button"
        onClick={() => setPicking((v) => !v)}
        className="w-full bg-[var(--surface)] border border-[var(--border)] font-bold text-sm rounded-xl py-3"
      >
        Choisir un adversaire
      </button>

      {picking && (
        <div className="mt-3 space-y-2">
          {eligibleTeams.length === 0 && (
            <p className="text-center text-xs text-[var(--text-faint)] py-3">
              Aucune équipe disponible pour l&apos;instant.
            </p>
          )}
          {eligibleTeams.map((t) => (
            <button
              key={t.id}
              onClick={() => start("chosen", t.id)}
              disabled={loading}
              className="w-full flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-xs flex-shrink-0"
                style={{ background: t.color }}
              >
                {t.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-sm font-semibold">{t.name}</span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-[var(--crimson)] text-xs text-center mt-3">{error}</p>}
    </div>
  );
}
