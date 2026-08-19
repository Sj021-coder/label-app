"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TIERS } from "@/lib/gameRules";
import { createClient } from "@/lib/supabase/client";

export default function RosterClient({
  roster,
  rosterSize,
  hasDiversity,
  captainArtistId,
  freeTransfers,
  penaltyPoints,
  recentEvents,
}) {
  const [loadingId, setLoadingId] = useState(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // The "stock ticker" feel, done honestly: scores only ever change when a
  // REAL sync writes a REAL number (twice daily) — nothing here is simulated
  // between syncs. What's live is the PUSH: anyone with this page open sees
  // that real write land instantly, no refresh needed, same idea as a stock
  // app telling you the second a real trade prints a new price.
  // Overrides layered on top of the server-provided roster, not a copy of it
  // — so there's no effect syncing prop-into-state (an anti-pattern); the
  // rendered roster is just derived at render time, self-correcting whenever
  // a fresh `roster` prop arrives (a captain change, page reload, etc.).
  const [liveOverrides, setLiveOverrides] = useState({});
  const [flashId, setFlashId] = useState(null);
  const [deltaFlash, setDeltaFlash] = useState(null); // { id, delta, key }
  const flashSeq = useRef(0);

  const liveRoster = roster.map((a) => (liveOverrides[a.id] ? { ...a, ...liveOverrides[a.id] } : a));

  useEffect(() => {
    const rosterIds = roster.map((a) => a.id);
    if (!rosterIds.length) return;

    const channel = supabase
      .channel("roster-live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "artists" },
        (payload) => {
          const updated = payload.new;
          const before = payload.old;
          if (!rosterIds.includes(updated.id)) return;

          setLiveOverrides((prev) => ({
            ...prev,
            [updated.id]: { score: updated.score, value: updated.value, value_reason: updated.value_reason },
          }));

          const delta = (updated.score ?? 0) - (before?.score ?? updated.score ?? 0);
          setFlashId(updated.id);
          if (delta !== 0) {
            setDeltaFlash({ id: updated.id, delta, key: (flashSeq.current += 1) });
          }
          setTimeout(() => setFlashId((cur) => (cur === updated.id ? null : cur)), 1000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roster, supabase]);

  const slots = [...liveRoster];
  while (slots.length < rosterSize) slots.push(null);

  async function setCaptain(artistId) {
    setLoadingId(artistId);
    const res = await fetch("/api/captain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artistId }),
    });
    setLoadingId(null);
    if (res.ok) router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold">
          Mon label ({liveRoster.length}/{rosterSize})
        </div>
        {liveRoster.length > 0 && !hasDiversity && (
          <span className="text-[11px] text-[var(--crimson)]">Règle diversité non respectée</span>
        )}
      </div>

      <Link
        href="/duel"
        className="flex items-center justify-between bg-[var(--surface)] border border-[var(--violet)]/40 rounded-xl px-3.5 py-2.5 mb-4 text-xs"
      >
        <span className="font-bold">⚔️ Défier quelqu&apos;un</span>
        <span className="text-[var(--violet)] font-bold">→</span>
      </Link>

      {/* Transfers/penalty status */}
      <div className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 mb-4 text-xs">
        <span className="text-[var(--text-faint)]">
          Transferts gratuits: <span className="text-[var(--gold)] font-bold">{freeTransfers}</span>
        </span>
        {penaltyPoints > 0 && (
          <span className="text-[var(--crimson)]">-{penaltyPoints} pts (transferts payants)</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-6">
        {slots.map((artist, i) =>
          artist ? (
            <div
              key={artist.id}
              className={`bg-[var(--surface)] border rounded-2xl p-2.5 relative transition-shadow ${
                artist.id === captainArtistId ? "border-[var(--gold)]" : "border-[var(--border)]"
              } ${flashId === artist.id ? "live-flash" : ""}`}
            >
              {artist.id === captainArtistId && (
                <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-[var(--gold)] text-[#1a1310] text-[10px] font-black flex items-center justify-center z-10">
                  C
                </div>
              )}
              {deltaFlash?.id === artist.id && (
                <span
                  key={deltaFlash.key}
                  className={`float-delta absolute top-1 right-1 mono text-xs font-bold z-10 ${
                    deltaFlash.delta > 0 ? "text-[var(--gold)]" : "text-[var(--crimson)]"
                  }`}
                >
                  {deltaFlash.delta > 0 ? "+" : ""}
                  {deltaFlash.delta}
                </span>
              )}
              <div className="mb-2 aspect-square rounded-xl overflow-hidden bg-[var(--surface-2)]">
                {artist.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={artist.image_url}
                    alt={artist.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-xl font-extrabold"
                    style={{ background: artist.color, color: "#1a1310" }}
                  >
                    {artist.initials}
                  </div>
                )}
              </div>
              <div className="text-xs font-bold mb-0.5 leading-tight">{artist.name}</div>
              <div className="text-[10px] text-[var(--text-faint)] mb-1">
                {TIERS[artist.tier]?.stars} · {artist.cost}M coût
              </div>
              {artist.value != null && artist.value !== artist.cost && (
                <div
                  className={`text-[10px] font-bold mb-1 ${
                    artist.value > artist.cost ? "text-[var(--gold)]" : "text-[var(--crimson)]"
                  }`}
                >
                  {artist.value > artist.cost ? "▲" : "▼"} Valeur: {artist.value}M
                </div>
              )}
              <div
                className={`text-xs font-bold mb-1.5 ${
                  artist.score >= 0 ? "text-[var(--gold)]" : "text-[var(--crimson)]"
                }`}
              >
                {artist.score >= 0 ? "▲" : "▼"} {Math.abs(artist.score)}
              </div>
              <button
                onClick={() => setCaptain(artist.id)}
                disabled={loadingId === artist.id || artist.id === captainArtistId}
                className={`w-full text-[10px] font-bold py-1 rounded-full ${
                  artist.id === captainArtistId
                    ? "bg-[var(--gold-soft)] text-[var(--gold)]"
                    : "bg-[var(--surface-2)] text-[var(--text-faint)]"
                }`}
              >
                {artist.id === captainArtistId ? "Capitaine ×2" : "Nommer capitaine"}
              </button>
            </div>
          ) : (
            <Link
              key={"empty-" + i}
              href="/draft"
              className="bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl p-2.5 flex flex-col items-center justify-center min-h-[140px] text-[var(--text-faint)]"
            >
              <div className="text-xl mb-1">+</div>
              <div className="text-[11px]">Ajouter</div>
            </Link>
          )
        )}
      </div>

      <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-3">
        Derniers évènements
      </div>
      {recentEvents.length === 0 ? (
        <div className="text-center text-[var(--text-faint)] text-sm py-6">
          {liveRoster.length === 0
            ? "Ajoute des artistes à ton label pour voir leur activité."
            : "Aucun évènement encore pour ton label."}
        </div>
      ) : (
        <div>
          {recentEvents.map((ev) => (
            <div
              key={ev.id}
              className="flex justify-between py-2 border-b border-[var(--border)] text-[13px]"
            >
              <span className="text-[var(--text-muted)]">
                <span className="font-semibold text-[var(--text)]">{ev.artists?.name}</span> —{" "}
                {ev.label}
                {ev.category && (
                  <span className="text-[var(--text-faint)]"> · {ev.category}</span>
                )}
              </span>
              <span
                className={`mono font-bold ${
                  ev.delta >= 0 ? "text-[var(--gold)]" : "text-[var(--crimson)]"
                }`}
              >
                {ev.delta >= 0 ? "+" : ""}
                {ev.delta}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
