"use client";

import { useState, useMemo } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import VinylAvatar from "@/components/VinylAvatar";
import {
  BUDGET_TOTAL,
  ROSTER_SIZE,
  TIERS,
  meetsDiversityRule,
  totalCost,
} from "@/lib/gameRules";

export default function DraftList({ artists, initialRosterIds, newsCounts = {} }) {
  const [rosterIds, setRosterIds] = useState(initialRosterIds);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const rosterArtists = useMemo(
    () => artists.filter((a) => rosterIds.includes(a.id)),
    [artists, rosterIds]
  );
  const spent = totalCost(rosterArtists);
  const remaining = BUDGET_TOTAL - spent;
  const hasDiversity = meetsDiversityRule(rosterArtists);

  async function toggle(artist) {
    setError("");
    const has = rosterIds.includes(artist.id);

    if (has) {
      const res = await fetch("/api/roster", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId: artist.id }),
      });
      if (res.ok) {
        setRosterIds((prev) => prev.filter((id) => id !== artist.id));
        startTransition(() => router.refresh());
      }
    } else {
      if (rosterIds.length >= ROSTER_SIZE) return;
      if (spent + artist.cost > BUDGET_TOTAL) {
        setError(`Budget insuffisant — il te reste ${remaining}M, cet artiste coûte ${artist.cost}M.`);
        return;
      }
      const res = await fetch("/api/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId: artist.id }),
      });
      if (res.ok) {
        setRosterIds((prev) => [...prev, artist.id]);
        startTransition(() => router.refresh());
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Erreur");
      }
    }
  }

  return (
    <div>
      {/* Budget bar */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-3 mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold">
            Budget
          </span>
          <span className="mono text-sm font-bold">
            {remaining}M <span className="text-[var(--text-faint)] font-normal">/ {BUDGET_TOTAL}M</span>
          </span>
        </div>
        <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--gold)] transition-all"
            style={{ width: `${Math.min(100, (spent / BUDGET_TOTAL) * 100)}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-[var(--text-faint)]">
            {rosterIds.length}/{ROSTER_SIZE} artistes
          </span>
          {!hasDiversity && rosterIds.length > 0 && (
            <span className="text-xs text-[var(--crimson)]">
              Il faut 1 artiste ⭐⭐ ou ⭐
            </span>
          )}
          {hasDiversity && (
            <span className="text-xs text-[var(--gold)]">✓ Règle diversité OK</span>
          )}
        </div>
      </div>

      {error && <p className="text-[var(--crimson)] text-xs mb-2">{error}</p>}

      {artists.map((a) => {
        const has = rosterIds.includes(a.id);
        const full = rosterIds.length >= ROSTER_SIZE && !has;
        const tooExpensive = !has && a.cost > remaining;
        const disabled = full || tooExpensive || pending;
        return (
          <div
            key={a.id}
            className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-3 py-2.5 mb-2"
          >
            <VinylAvatar initials={a.initials} color={a.color} size={42} />
            <div className="flex-1">
              <div className="text-sm font-bold flex items-center gap-1.5">
                {a.name}
                {newsCounts[a.id] > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--violet)] text-white">
                    📰 {newsCounts[a.id]}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-faint)]">{TIERS[a.tier]?.stars}</span>
                <span className="mono text-xs text-[var(--gold)] font-bold">{a.cost}M</span>
              </div>
            </div>
            <button
              disabled={disabled}
              onClick={() => toggle(a)}
              className={`text-xs font-bold px-3.5 py-1.5 rounded-full whitespace-nowrap ${
                has
                  ? "bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)]"
                  : disabled
                  ? "bg-[var(--surface-2)] text-[var(--text-faint)]"
                  : "bg-[var(--gold)] text-[#1a1310]"
              }`}
            >
              {has ? "Retirer" : full ? "Complet" : tooExpensive ? "Trop cher" : "+ Ajouter"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
