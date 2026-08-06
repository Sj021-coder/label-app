"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SCORING_EVENTS, CATEGORIES } from "@/lib/scoringEvents";

export default function AdminForm({ artists }) {
  const [artistId, setArtistId] = useState(artists[0]?.id || "");
  const [eventKey, setEventKey] = useState(SCORING_EVENTS[0].key);
  const [customDelta, setCustomDelta] = useState(0);
  const [customCategory, setCustomCategory] = useState(CATEGORIES[0].key);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const router = useRouter();
  const supabase = createClient();

  const loadHistory = useCallback(async () => {
    if (!artistId) return;
    const { data } = await supabase
      .from("score_events")
      .select("id, label, delta, category, created_at")
      .eq("artist_id", artistId)
      .order("created_at", { ascending: false })
      .limit(10);
    setHistory(data || []);
  }, [artistId, supabase]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const isCustom = eventKey === "custom";
  const currentArtist = artists.find((a) => a.id === artistId);
  const selectedEvent = SCORING_EVENTS.find((e) => e.key === eventKey);

  async function handleApply() {
    setError("");
    setLoading(true);
    const res = await fetch("/api/score-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artistId, eventKey, customDelta, customCategory, reason }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Erreur");
      return;
    }
    setCustomDelta(0);
    setReason("");
    loadHistory();
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3.5">
        <label className="block text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-1.5">
          Artiste
        </label>
        <select
          value={artistId}
          onChange={(e) => setArtistId(e.target.value)}
          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm"
        >
          {artists.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.score} pts)
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3.5">
        <label className="block text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-1.5">
          Évènement
        </label>
        <select
          value={eventKey}
          onChange={(e) => setEventKey(e.target.value)}
          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm"
        >
          {SCORING_EVENTS.map((ev) => (
            <option key={ev.key} value={ev.key}>
              {ev.label} ({ev.delta > 0 ? "+" : ""}
              {ev.delta})
            </option>
          ))}
        </select>
        {!isCustom && selectedEvent && (
          <p className="text-[11px] text-[var(--text-faint)] mt-1">
            Catégorie : {selectedEvent.category}
          </p>
        )}
      </div>

      {isCustom && (
        <>
          <div className="mb-3.5">
            <label className="block text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-1.5">
              Catégorie
            </label>
            <select
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-3.5">
            <label className="block text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-1.5">
              Points (+/-)
            </label>
            <input
              type="number"
              value={customDelta}
              onChange={(e) => setCustomDelta(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
          <div className="mb-3.5">
            <label className="block text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-1.5">
              Raison
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Décris l'évènement"
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
        </>
      )}

      {error && <p className="text-[var(--crimson)] text-xs mb-2">{error}</p>}

      <button
        onClick={handleApply}
        disabled={loading}
        className="w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3 disabled:opacity-60"
      >
        {loading ? "..." : "Appliquer"}
      </button>

      <div className="mt-6">
        <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-2">
          Historique — {currentArtist?.name}
        </div>
        {history.length === 0 ? (
          <div className="text-center text-[var(--text-faint)] text-sm py-4">
            Aucun évènement encore.
          </div>
        ) : (
          history.map((h) => (
            <div
              key={h.id}
              className="flex justify-between py-2 border-b border-[var(--border)] text-[13px]"
            >
              <span className="text-[var(--text-muted)]">
                {h.label}
                {h.category && <span className="text-[var(--text-faint)]"> · {h.category}</span>}
              </span>
              <span
                className={`mono font-bold ${
                  h.delta >= 0 ? "text-[var(--gold)]" : "text-[var(--crimson)]"
                }`}
              >
                {h.delta >= 0 ? "+" : ""}
                {h.delta}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
