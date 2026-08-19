"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartUserDuel({ teammates }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);

  async function start(mode, opponentUserId) {
    setError("");
    setLoading(true);
    const res = await fetch("/api/user-duel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, opponentUserId }),
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
      {teammates.length > 0 && (
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          className="w-full bg-[var(--surface)] border border-[var(--border)] font-bold text-sm rounded-xl py-3"
        >
          Défier un pote d&apos;équipe
        </button>
      )}

      {picking && (
        <div className="mt-3 space-y-2">
          {teammates.map((t) => (
            <button
              key={t.id}
              onClick={() => start("chosen", t.id)}
              disabled={loading}
              className="w-full flex items-center justify-between bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5"
            >
              <span className="text-sm font-semibold">{t.username}</span>
              <span className="text-xs text-[var(--violet)] font-bold">Défier</span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-[var(--crimson)] text-xs text-center mt-3">{error}</p>}
    </div>
  );
}
