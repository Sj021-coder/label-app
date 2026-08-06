"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import VinylAvatar from "@/components/VinylAvatar";
import { TIERS } from "@/lib/gameRules";

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

  const slots = [...roster];
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
          Mon label ({roster.length}/{rosterSize})
        </div>
        {roster.length > 0 && !hasDiversity && (
          <span className="text-[11px] text-[var(--crimson)]">Règle diversité non respectée</span>
        )}
      </div>

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
              className={`bg-[var(--surface)] border rounded-2xl p-2.5 relative ${
                artist.id === captainArtistId ? "border-[var(--gold)]" : "border-[var(--border)]"
              }`}
            >
              {artist.id === captainArtistId && (
                <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-[var(--gold)] text-[#1a1310] text-[10px] font-black flex items-center justify-center z-10">
                  C
                </div>
              )}
              <div className="mb-2">
                <VinylAvatar initials={artist.initials} color={artist.color} size={"100%"} />
              </div>
              <div className="text-xs font-bold mb-0.5 leading-tight">{artist.name}</div>
              <div className="text-[10px] text-[var(--text-faint)] mb-1">
                {TIERS[artist.tier]?.stars} · {artist.cost}M
              </div>
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
          {roster.length === 0
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
